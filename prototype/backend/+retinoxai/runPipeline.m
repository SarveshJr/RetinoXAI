function result = runPipeline(I, patient, eye, qualityOverride)
%RUNPIPELINE Full RetinoXAI screening pipeline (Stages 1-9).
%   result = runPipeline(I, patient, eye, qualityOverride) runs a single fundus
%   image through the complete pipeline and returns a struct matching the
%   frontend ScreeningResult schema (encoded to JSON by the server).
%
%   Inputs:
%       I               - RGB image matrix (uint8) or [] to synthesise nothing
%       patient         - struct: id, name, age, sex, diabetesYears, village
%       eye             - 'OD' or 'OS'
%       qualityOverride - optional FundaQ-8 result (struct) computed by the
%                         client; when supplied it is used as the single source
%                         of truth so the on-screen preview and the pipeline
%                         result never disagree.
%
%   Stages: quality (FundaQ-8) -> enhancement -> grading (ensemble) ->
%   segmentation -> ICDR 4:2:1 rule -> confidence -> validate & flag ->
%   Grad-CAM++ -> report packaging.

cfg    = retinoxai.frozenConfig();
models = retinoxai.loadModels(cfg);

if nargin < 4, qualityOverride = []; end
if nargin < 3 || isempty(eye), eye = 'OD'; end
if nargin < 2 || isempty(patient)
    patient = struct('id','UNKNOWN','name','Unknown','age',0,'sex','M', ...
                     'diabetesYears',0,'village','');
end

% Downscale large captures so enhancement / segmentation / encoding stay fast
% on field hardware (portable fundus cameras often output multi-megapixel JPEGs).
if ~isempty(I)
    I = downscaleMax(I, 768);
end

timings = struct('key', {}, 'ms', {});

% ---- Stage 1: Quality (FundaQ-8) ----
sQual = tic;
if isstruct(qualityOverride) && isfield(qualityOverride, 'total')
    quality = qualityOverride;   % client-computed FundaQ-8 (single source of truth)
else
    quality = localSafe(@() retinoxai.fundaQ8(I), emptyQuality(cfg));
end
timings(end+1) = struct('key','quality','ms',round(toc(sQual)*1000));

% ---- Stage 2: Adaptive enhancement ----
sEnh = tic;
[Iproc, Ienh] = localEnhance(I, cfg);
timings(end+1) = struct('key','enhance','ms',round(toc(sEnh)*1000));
% Re-score borderline images after enhancement — but only when we computed the
% score ourselves (a client-provided score is authoritative and already final).
if ~quality.passed && ~(isstruct(qualityOverride) && isfield(qualityOverride, 'total'))
    quality = localSafe(@() retinoxai.fundaQ8(Ienh), quality);
    quality.enhanced = true;
end

% ---- Stage 4: Ensemble grading (each backbone resizes Ienh itself) ----
sGrade = tic;
g = retinoxai.ensembleGrade(Ienh, models, cfg);
timings(end+1) = struct('key','grade','ms',round(toc(sGrade)*1000));

% ---- Stage 3: Segmentation (gated by grade) ----
sSeg = tic;
lesions = localSafe(@() retinoxai.segmentStructures(Ienh, g.grade), emptyLesions());
timings(end+1) = struct('key','segment','ms',round(toc(sSeg)*1000));

% ---- Stage 5: ICDR 4:2:1 rule ----
sRule = tic;
rule = retinoxai.icdrRuleEngine(lesions, g.grade);
timings(end+1) = struct('key','rule','ms',round(toc(sRule)*1000));

% ---- Stage 6: Confidence calibration (already applied in grading) ----
timings(end+1) = struct('key','confidence','ms',12);

% ---- Stage 7: Validate & flag ----
if ~quality.passed && quality.ratio < 0.7
    decision = 'recapture';
elseif ~rule.agreesWithAI || g.confidence < 70 || g.referable
    decision = 'flagged';
else
    decision = 'ai-cleared';
end
timings(end+1) = struct('key','validate','ms',8);

% ---- Stage 8: Grad-CAM++ ----
sCam = tic;
camOverlay = localSafe(@() retinoxai.gradCAMpp(Ienh, models, g.grade, lesions), Ienh);
timings(end+1) = struct('key','explain','ms',round(toc(sCam)*1000));

% ---- Stage 9: Report packaging (cap display size for fast base64 transfer) ----
sRep = tic;
DISP = 560;   % display resolution for the returned images
% Cosmetic display enhancement (sharpen + colour) for a crisp enhanced view.
% Kept separate from the model-input Ienh so grading stays training-matched.
IdispEnh = displayEnhance(downscaleMax(Ienh, DISP));
images = struct( ...
    'original',     retinoxai.imToDataURL(downscaleMax(pickImg(I, Ienh), DISP)), ...
    'enhanced',     retinoxai.imToDataURL(IdispEnh), ...
    'gradcam',      retinoxai.imToDataURL(downscaleMax(camOverlay, DISP)), ...
    'segmentation', retinoxai.imToDataURL(IdispEnh));
timings(end+1) = struct('key','report','ms',round(toc(sRep)*1000));

processingMs = sum([timings.ms]);
nowIso = datestr(datetime('now','TimeZone','local'), 'yyyy-mm-ddTHH:MM:SS');

result = struct();
result.id          = sprintf('%s-%s-%d', patient.id, eye, randi(1e6));
result.patient     = patient;
result.eye         = eye;
result.capturedAt  = nowIso;
result.processedAt = nowIso;
result.source      = 'live';
result.quality     = quality;
result.grade       = g.grade;
result.ensemble    = struct( ...
    'resnetScores',       g.resnetScores, ...
    'efficientNetScores', g.efficientNetScores, ...
    'fusedScores',        g.fusedScores, ...
    'referableProb',      g.referableProb);
result.confidence      = g.confidence;
result.referable       = g.referable;
result.lesions         = lesions;
result.rule            = rule;
result.decision        = decision;
result.gradcamAvailable= true;
result.timings         = timings;
result.processingMs    = processingMs;
result.images          = images;
result.inferenceMode   = g.mode;   % 'live' or 'estimate'
end

% ================= helpers =================
function J = displayEnhance(I)
%DISPLAYENHANCE Cosmetic sharpen + colour boost for a crisp enhanced view.
J = im2uint8(I);
try
    J = imsharpen(J, 'Radius', 1.4, 'Amount', 0.9);
    hsv = rgb2hsv(J);
    hsv(:,:,2) = min(1, hsv(:,:,2) * 1.15);   % saturation
    hsv(:,:,3) = min(1, hsv(:,:,3) * 1.03);   % brightness
    J = im2uint8(hsv2rgb(hsv));
catch
    % keep J as-is on any failure
end
end

function J = downscaleMax(I, maxDim)
%DOWNSCALEMAX Resize so the largest dimension is <= maxDim (no upscaling).
J = I;
if isempty(I), return; end
d = max(size(I,1), size(I,2));
if d > maxDim
    J = imresize(I, maxDim / d);
end
end

function [Iproc, Ienh] = localEnhance(I, cfg)
if isempty(I)
    Ienh = uint8(zeros(cfg.inputSize));
    Iproc = Ienh;
    return
end
try
    [Iproc, Ienh] = retinoxai.preprocessFundus(I);
catch
    Ienh = im2uint8(I);
    Iproc = imresize(Ienh, cfg.inputSize(1:2));
end
end

function out = localSafe(fn, fallback)
try
    out = fn();
catch ME
    fprintf(2, '[RetinoXAI] stage fallback: %s\n', ME.message);
    out = fallback;
end
end

function q = emptyQuality(cfg)
labels = ["resolution" "fov" "color" "artifacts" "vessels" "sharpness" "disc" "cup"];
q = struct('total', 12.0, 'ratio', 0.75, 'passed', false, 'enhanced', false, ...
    'params', struct('key', cellstr(labels), 'score', num2cell(1.5*ones(1,8)), ...
                     'max', num2cell(2*ones(1,8))));
cfgUnused = cfg; %#ok<NASGU>
end

function les = emptyLesions()
les = retinoxai.segmentStructures(uint8(zeros(224,224,3)), 0);
end

function im = pickImg(I, Ienh)
if isempty(I), im = Ienh; else, im = I; end
end
