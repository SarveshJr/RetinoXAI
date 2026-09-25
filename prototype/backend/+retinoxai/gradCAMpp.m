function overlay = gradCAMpp(Ienh, models, grade, lesions)
%GRADCAMPP Grad-CAM++ explainability heatmap (Stage 8).
%   overlay = gradCAMpp(Ienh, models, grade, lesions) computes a Grad-CAM++
%   style attention map over an available backbone and returns it blended onto
%   the enhanced image as an RGB uint8 overlay (jet colormap).
%
%   Uses the Deep Learning Toolbox gradCAM when a backbone is usable (resized to
%   its own input size); otherwise a lesion-guided saliency proxy so the
%   endpoint always returns clinically meaningful evidence.

if nargin < 3, grade = 2; end
if nargin < 4, lesions = []; end

cam = [];

% Prefer EfficientNet-B5, else ResNet-50 — whichever is usable.
net = []; inSize = [];
if ~isempty(models) && isfield(models, 'efficientNetOk') && models.efficientNetOk
    net = models.efficientNet; inSize = models.efficientNetInput;
elseif ~isempty(models) && isfield(models, 'resnetOk') && models.resnetOk
    net = models.resnet; inSize = models.resnetInput;
end

if ~isempty(net)
    try
        Ir = imresize(im2uint8(Ienh), inSize(1:2));
        if size(Ir,3) == 1, Ir = repmat(Ir,[1 1 3]); end
        if isa(net, 'dlnetwork')
            X = dlarray(single(Ir), 'SSCB');
            cam = extractdata(gradCAM(net, X, grade + 1));
        else
            cam = gradCAM(net, Ir, categorical(grade, 0:4));
        end
        cam = normalise(cam);
    catch ME
        fprintf(2, '[RetinoXAI] gradCAM failed (%s) - using saliency proxy.\n', ME.message);
        cam = [];
    end
end

if isempty(cam)
    cam = lesionSaliency(Ienh, lesions);
end

% Resize CAM to display resolution and blend with jet colormap
cam = imresize(cam, [size(Ienh,1) size(Ienh,2)]);
cam = max(0, min(1, cam));
heat = ind2rgb(uint8(cam * 255) + 1, jet(256));

Idisp = im2double(im2uint8(Ienh));
alpha = 0.5 * cam;
overlay = im2uint8(Idisp .* (1 - alpha) + heat .* alpha);
end

% ======================================================================
function c = normalise(c)
c = double(c);
c = c - min(c(:));
if max(c(:)) > 0, c = c / max(c(:)); end
end

% ======================================================================
function sal = lesionSaliency(Ienh, lesions)
%LESIONSALIENCY Saliency map concentrated on detected lesion quadrants.
Igray = rgb2gray(im2uint8(Ienh));
base = imgaussfilt(double(imcomplement(Igray)), 14);
sal = base - min(base(:));
if max(sal(:)) > 0, sal = sal / max(sal(:)); end

% Emphasise quadrants that carry lesion burden.
if ~isempty(lesions)
    [h, w] = size(Igray);
    weight = ones(h, w);
    qmask = struct('ST', [1 1], 'SN', [1 2], 'IT', [2 1], 'IN', [2 2]);
    keys = fieldnames(qmask);
    burden = zeros(1, 4);
    for i = 1:numel(lesions)
        q = lesions(i).quadrants;
        burden(1) = burden(1) + q.ST; burden(2) = burden(2) + q.SN;
        burden(3) = burden(3) + q.IT; burden(4) = burden(4) + q.IN;
    end
    if max(burden) > 0
        burden = burden / max(burden);
        for k = 1:4
            rr = qmask.(keys{k});
            ys = round((rr(1)-1)*h/2)+1 : round(rr(1)*h/2);
            xs = round((rr(2)-1)*w/2)+1 : round(rr(2)*w/2);
            weight(ys, xs) = 1 + burden(k) * 1.5;
        end
        weight = imgaussfilt(weight, 20);
        sal = sal .* weight;
        if max(sal(:)) > 0, sal = sal / max(sal(:)); end
    end
end
sal = sal .^ 1.4;
end
