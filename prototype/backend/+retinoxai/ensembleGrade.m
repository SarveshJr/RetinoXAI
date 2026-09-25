function g = ensembleGrade(Ienh, models, cfg)
%ENSEMBLEGRADE Weighted-softmax ensemble grading + calibrated confidence.
%   g = ensembleGrade(Ienh, models, cfg) runs the enhanced fundus through the
%   available backbones (each resized to its OWN input size) and returns the
%   ICDR grade, calibrated confidence and referable probability.
%
%   Decision (grade + referable) uses the frozen weighted-softmax averaging.
%   Confidence uses temperature scaling on the pre-softmax LOGITS (Guo et al.,
%   2017) - scaling the already-saturated softmax cannot fix over-confidence,
%   which is why single CNNs report ~99%. Logits are read from the 'fc_DR'
%   layer; if unavailable the softmax is used as a fallback.
%
%   Robustness: each backbone runs independently. If only one is usable it is
%   used alone (weights renormalized) with a softer temperature, and g.mode is
%   'live-resnet' / 'live-efficientnet'. If neither works, a deterministic
%   estimate is returned.

if nargin < 3, cfg = retinoxai.frozenConfig(); end

g = struct();

[pr, zr] = tryModel(getf(models,'resnet'),       getf(models,'resnetOk'),       Ienh, getf(models,'resnetInput',[224 224 3]));
[pe, ze] = tryModel(getf(models,'efficientNet'), getf(models,'efficientNetOk'), Ienh, getf(models,'efficientNetInput',[456 456 3]));

haveR = numel(pr) == 5;
haveE = numel(pe) == 5;

if haveR || haveE
    % --- Decision: frozen weighted-softmax averaging (faithful) ---
    if haveR && haveE
        fused = cfg.resnetWeight * pr + cfg.efficientNetWeight * pe;
        mode = 'live';
        single = false;
    elseif haveR
        fused = pr; mode = 'live-resnet'; single = true;
    else
        fused = pe; mode = 'live-efficientnet'; single = true;
    end
    fused = fused / sum(fused);
    [~, idx] = max(fused);
    grade = idx - 1;
    referableProbRaw = sum(fused(3:5));   % decision uses the frozen threshold

    % --- Calibrated confidence: temperature scaling on LOGITS ---
    T = cfg.confTemperature;
    if single, T = cfg.confTemperatureSingle; end
    cr = calibrated(zr, pr, T);
    ce = calibrated(ze, pe, T);
    if haveR && haveE
        fusedCal = cfg.resnetWeight * cr + cfg.efficientNetWeight * ce;
    elseif haveR
        fusedCal = cr;
    else
        fusedCal = ce;
    end
    fusedCal = fusedCal / sum(fusedCal);
    referableProbCal = sum(fusedCal(3:5));
    referable = referableProbRaw >= cfg.referableThreshold;

    % Confidence in the actionable REFERRAL decision (refer vs not) — the metric
    % a screening tool acts on. High when the decision is clear (clear PDR or
    % clear No-DR), lower only when the case is genuinely ambiguous (which then
    % correctly routes to doctor review). This is far more clinically meaningful
    % than P(exact 5-class grade), which is inherently low for ordinal grading.
    if referable
        decisionConf = referableProbCal;
    else
        decisionConf = 1 - referableProbCal;
    end

    g.grade              = grade;
    g.resnetScores       = ensure5(pr, fused);
    g.efficientNetScores = ensure5(pe, fused);
    g.fusedScores        = fusedCal(:)';   % calibrated distribution for display
    g.confidence         = round(decisionConf * 1000) / 10;
    g.referableProb      = referableProbCal;
    g.referable          = referable;
    g.mode               = mode;

    % Diagnostic: raw grade-conf vs referral-decision conf for inspection.
    fprintf(['[RetinoXAI] grade=%d gradeConf=%.1f%% referralConf=%.1f%% ' ...
             'refProb=%.1f%% mode=%s T=%.2f logits=%d\n'], grade, ...
             fusedCal(idx)*100, decisionConf*100, referableProbCal*100, mode, T, ...
             (numel(zr)==5) + (numel(ze)==5));
    return
end

% ---- Deterministic estimate fallback ----
g = estimateGrade(Ienh, cfg);
end

% ======================================================================
function [p, z] = tryModel(net, ok, Ienh, inputSize)
%TRYMODEL Return softmax probs p (1x5) and pre-softmax logits z (1x5 or []).
p = []; z = [];
if isempty(net) || isempty(ok) || ~ok, return; end
try
    Ir = imresize(im2uint8(Ienh), inputSize(1:2));
    if size(Ir, 3) == 1, Ir = repmat(Ir, [1 1 3]); end
    z = getLogits(net, Ir);            % [] if the fc layer can't be read
    if numel(z) == 5
        p = softmaxVec(z);
    else
        p = softmaxScores(rawPredict(net, Ir));
        z = [];
    end
catch ME
    fprintf(2, '[RetinoXAI] backbone predict failed (%s)\n', ME.message);
    p = []; z = [];
end
end

function z = getLogits(net, Ir)
%GETLOGITS Pre-softmax activations of the 'fc_DR' layer, or [] on failure.
z = [];
try
    if isa(net, 'dlnetwork')
        X = dlarray(single(Ir), 'SSCB');
        z = double(gather(extractdata(predict(net, X, 'Outputs', 'fc_DR'))));
    else
        z = double(activations(net, Ir, 'fc_DR'));
    end
    z = z(:)';
    if numel(z) ~= 5, z = []; end
catch
    z = [];
end
end

function raw = rawPredict(net, Ir)
if isa(net, 'dlnetwork')
    X = dlarray(single(Ir), 'SSCB');
    raw = double(gather(extractdata(predict(net, X))));
else
    raw = double(predict(net, Ir));
end
raw = raw(:)';
end

function c = calibrated(z, p, T)
%CALIBRATED Temperature-scaled distribution: softmax(logits / T), else softmax(p).
if numel(z) == 5
    c = softmaxVec(z / T);
elseif numel(p) == 5
    % Fallback: treat log-probs as pseudo-logits (limited effect when saturated).
    c = softmaxVec(log(p + 1e-9) / T);
else
    c = ones(1, 5) / 5;
end
end

function p = softmaxScores(s)
s = s(:)';
if numel(s) ~= 5
    if numel(s) > 5, s = s(1:5); else, s(end+1:5) = min(s); end
end
if abs(sum(s) - 1) > 1e-3 || any(s < 0)
    p = softmaxVec(s);
else
    p = s;
end
end

function v = ensure5(s, fallback)
if numel(s) == 5, v = s(:)'; else, v = fallback(:)'; end
end

function p = softmaxVec(x)
x = x(:)';
x = x - max(x);
e = exp(x);
p = e / sum(e);
end

function v = getf(s, f, d)
if nargin < 3, d = []; end
if isstruct(s) && isfield(s, f), v = s.(f); else, v = d; end
end

function g = estimateGrade(Ienh, cfg)
%ESTIMATEGRADE Deterministic pseudo-grade from image statistics (no model).
Igray = rgb2gray(im2uint8(Ienh));
mask = Igray > 10;
darkFrac = nnz((Igray < 60) & mask) / max(1, nnz(mask));
sev = min(4, max(0, round(darkFrac * 12)));
scores = zeros(1, 5);
for k = 0:4
    scores(k+1) = exp(-abs(k - sev) * 1.6);
end
cal = scores / sum(scores);
[~, idx] = max(cal);
g.grade = idx - 1;
g.resnetScores = cal;
g.efficientNetScores = cal;
g.fusedScores = cal;
g.confidence = round(cal(idx) * 1000) / 10;
g.referableProb = sum(cal(3:5));
g.referable = g.referableProb >= cfg.referableThreshold;
g.mode = 'estimate';
end
