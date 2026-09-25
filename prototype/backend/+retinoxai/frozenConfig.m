function cfg = frozenConfig()
%FROZENCONFIG Frozen ensemble configuration for RetinoXAI (Iteration 2).
%   Returns the locked ResNet-50 / EfficientNet-B5 ensemble weights, the
%   referable-DR probability threshold and the validated performance metrics.
%   These values are taken verbatim from the Iteration 2 validation/test
%   report and MUST NOT be re-tuned on the internal test set.

cfg = struct();

% --- Ensemble (weighted-softmax averaging) ---
cfg.resnetWeight         = 0.35;
cfg.efficientNetWeight   = 0.65;
cfg.referableThreshold   = 0.37;   % P(grade >= 2) cut-off for referral
cfg.calibration          = 'Temperature scaling';
cfg.temperature          = 1.15;
% Temperature scaling is applied to the pre-softmax LOGITS (Guo et al. 2017) to
% produce a calibrated confidence, NOT to the already-saturated softmax. A single
% backbone is less calibrated than the ensemble, so it uses a softer temperature.
% (Re-fit these on the validation set for production.)
cfg.confTemperature      = 1.15;   % full ensemble (mild)
cfg.confTemperatureSingle= 1.20;   % single-backbone (mild; near raw model confidence)

% --- FundaQ-8 quality gate ---
cfg.fundaq8PassRatio     = 0.80;   % >= 80% (>= 12.8 / 16) accepted directly
cfg.inputSize            = [224 224 3];

% --- ICDR classes ---
cfg.classNames           = ["0" "1" "2" "3" "4"];
cfg.numClasses           = 5;

% --- Validated metrics (internal held-out test) ---
cfg.metrics = struct( ...
    'sensitivity',   93.13, ...
    'specificity',   94.27, ...
    'accuracy5class', 81.34);

% --- Model paths. Anchored to the backend script location (absolute) so the
%     weights resolve regardless of MATLAB's current working directory. The
%     .mat files live in <repoRoot>/main_model/ada. Override in config.json ---
cfg.modelVersion         = 'RetinoXAI-ensemble-v2 (frozen)';
% Bump this whenever backend logic changes, so a running server can be verified
% as up to date via GET /api/health (build field) and the startup banner.
cfg.buildTag             = 'b4-referral-conf-enh';
here        = fileparts(mfilename('fullpath'));   % ...\backend\+retinoxai
backendRoot = fileparts(here);                    % ...\backend
repoRoot    = fileparts(fileparts(backendRoot));  % repo root (contains main_model)
modelDir    = fullfile(repoRoot, 'main_model', 'ada');
cfg.resnetModelFile      = fullfile(modelDir, 'resnet50_processed_IDRiD_APTOS.mat');
cfg.efficientNetModelFile= fullfile(modelDir, 'efficientnetB5_processed_IDRiD_APTOS.mat');

end
