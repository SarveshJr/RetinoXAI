function models = loadModels(cfg)
%LOADMODELS Load, initialize and cache the trained ensemble backbones.
%   models = loadModels(cfg) loads the ResNet-50 and EfficientNet-B5 networks
%   from the .mat files referenced in cfg. Networks are cached in a persistent
%   variable so they are only read from disk once per MATLAB session.
%
%   dlnetwork objects are saved uninitialized; this initializes them with a
%   dummy input matching each network's own input size (ResNet-50 = 224, the
%   ONNX EfficientNet-B5 = 456), so predict/forward work directly.
%
%   Returned struct fields:
%       .resnet / .efficientNet   trained networks (or [])
%       .resnetInput / .efficientNetInput   [H W C] input sizes
%       .resnetOk / .efficientNetOk         usable (loaded + initialized)
%       .available                any backbone usable

persistent CACHE
if ~isempty(CACHE)
    models = CACHE;
    return
end

if nargin < 1
    cfg = retinoxai.frozenConfig();
end

models = struct('resnet', [], 'efficientNet', [], ...
    'resnetInput', [224 224 3], 'efficientNetInput', [456 456 3], ...
    'resnetOk', false, 'efficientNetOk', false, 'available', false);

% --- ResNet-50 ---
try
    S = load(cfg.resnetModelFile);
    net = pickNetwork(S);
    models.resnetInput = netInputSize(net, [224 224 3]);
    net = ensureInitialized(net, models.resnetInput);
    models.resnet = net;
    models.resnetOk = true;
    fprintf('[RetinoXAI] ResNet-50 ready (input %dx%dx%d)\n', models.resnetInput);
catch ME
    fprintf(2, '[RetinoXAI] ResNet-50 not usable (%s)\n', ME.message);
end

% --- EfficientNet-B5 ---
try
    S = load(cfg.efficientNetModelFile);
    net = pickNetwork(S);
    models.efficientNetInput = netInputSize(net, [456 456 3]);
    net = ensureInitialized(net, models.efficientNetInput);
    models.efficientNet = net;
    models.efficientNetOk = true;
    fprintf('[RetinoXAI] EfficientNet-B5 ready (input %dx%dx%d)\n', models.efficientNetInput);
catch ME
    fprintf(2, '[RetinoXAI] EfficientNet-B5 not usable (%s)\n', ME.message);
end

models.available = models.resnetOk || models.efficientNetOk;

if models.resnetOk && models.efficientNetOk
    fprintf('[RetinoXAI] Inference: LIVE ensemble (both backbones)\n');
elseif models.available
    fprintf(2, '[RetinoXAI] Inference: LIVE single backbone (one backbone unavailable)\n');
else
    fprintf(2, '[RetinoXAI] Inference: ESTIMATE fallback (no usable backbone)\n');
end

CACHE = models;
end

% ======================================================================
function net = pickNetwork(S)
%PICKNETWORK Extract the first network-like object from a loaded struct.
net = [];
fn = fieldnames(S);
for i = 1:numel(fn)
    v = S.(fn{i});
    if isa(v, 'SeriesNetwork') || isa(v, 'DAGNetwork') || isa(v, 'dlnetwork')
        net = v;
        return
    end
end
error('No trained network object found in .mat file.');
end

function sz = netInputSize(net, def)
%NETINPUTSIZE Best-effort [H W C] input size from the first input layer.
sz = def;
try
    L = net.Layers;
    for i = 1:numel(L)
        if isprop(L(i), 'InputSize')
            v = L(i).InputSize;
            if numel(v) == 3
                sz = double(v);
                return
            elseif numel(v) == 1
                sz = [def(1) def(2) double(v)];
                return
            end
        end
    end
catch
end
end

function net = ensureInitialized(net, inputSize)
%ENSUREINITIALIZED Initialize an uninitialized dlnetwork with a dummy input.
if isa(net, 'dlnetwork')
    isInit = false;
    try, isInit = net.Initialized; catch, isInit = false; end
    if ~isInit
        eg = dlarray(zeros([inputSize 1], 'single'), 'SSCB');
        net = initialize(net, eg);   % throws if the graph is broken
    end
end
end
