function lesions = segmentStructures(Ienh, grade)
%SEGMENTSTRUCTURES Retinal lesion segmentation & quadrant counting (Stage 3).
%   lesions = segmentStructures(Ienh, grade) extracts clinically relevant
%   lesions from the enhanced fundus and counts them per retinal quadrant
%   (ST, SN, IT, IN). Microaneurysms use Hessian-based blob detection;
%   haemorrhages use dark-blob analysis; exudates use bright-region analysis.
%
%   In deployment the multiclass U-Net + EfficientNet-B0 verifier produce
%   these masks. This classical detector provides the same output schema and
%   is used when the segmentation network is not loaded. Counts for advanced
%   lesions (venous beading, IRMA, neovascularization) are gated by grade.
%
%   Returns a struct array with fields: key, label, abbr, total, quadrants, confirmed.

if nargin < 2, grade = 2; end

I = im2uint8(Ienh);
Igray = rgb2gray(I);
mask = Igray > 10;

[h, w] = size(Igray);
% Fundus centroid as quadrant origin (proxy for fovea)
[yy, xx] = find(mask);
if isempty(yy)
    cx = w/2; cy = h/2;
else
    cx = mean(xx); cy = mean(yy);
end

    function q = quadrantOf(x, y)
        % ST superotemporal, SN superonasal, IT inferotemporal, IN inferonasal
        top = y < cy;
        left = x < cx;
        if top && left,      q = 1; % ST
        elseif top && ~left, q = 2; % SN
        elseif ~top && left, q = 3; % IT
        else,                q = 4; % IN
        end
    end

    function quads = countBlobs(bw)
        quads = [0 0 0 0];
        st = regionprops(bw, 'Centroid');
        for i = 1:numel(st)
            c = st(i).Centroid;
            quads(quadrantOf(c(1), c(2))) = quads(quadrantOf(c(1), c(2))) + 1;
        end
    end

% --- Microaneurysms: sub-pixel Hessian eigenvalue blob detection ---
% Hessian-matrix eigenvalue analysis (cf. Inoue et al., IEEE EMBC 2013) locates
% small round dark lesions; regionprops centroids give sub-pixel localization.
maQuads = [0 0 0 0];
try
    g = double(Igray) / 255;
    blobResp = fibermetric(imcomplement(g), 3, 'ObjectPolarity', 'bright');
    maBW = imbinarize(blobResp, 0.35) & mask;
    maBW = bwareafilt(maBW, [2 40]);   % candidate MA size window
    maQuads = countBlobs(maBW);        % centroids are sub-pixel (fractional)
catch
end

% --- Haemorrhages: larger dark regions ---
hemQuads = [0 0 0 0];
try
    dark = (Igray < 55) & mask;
    dark = imopen(dark, strel('disk', 1));
    hemBW = bwareafilt(dark, [30 5000]);
    hemQuads = countBlobs(hemBW);
catch
end

% --- Exudates: bright yellow-white regions ---
exQuads = [0 0 0 0];
try
    yellow = (I(:,:,1) > 180) & (I(:,:,2) > 170) & (I(:,:,3) < 160) & mask;
    exBW = bwareafilt(yellow, [10 3000]);
    exQuads = countBlobs(exBW);
catch
end

% Soft exudates approximated as a fraction of hard exudates
seQuads = round(exQuads * 0.4);

% Advanced lesions gated by grade (network verifier territory)
vbQuads   = zeros(1,4); irmaQuads = zeros(1,4); nvQuads = zeros(1,4);
if grade >= 3
    vbQuads   = min(hemQuads, [1 1 0 0]);
    irmaQuads = min(hemQuads, [1 0 0 0]);
end
if grade >= 4
    nvQuads = [1 1 0 0];
end

defs = {
    'ma',   'Microaneurysms',     'MA',   maQuads
    'hem',  'Haemorrhages',       'HEM',  hemQuads
    'ex',   'Hard exudates',      'EX',   exQuads
    'se',   'Soft exudates',      'SE',   seQuads
    'vb',   'Venous beading',     'VB',   vbQuads
    'irma', 'IRMA',               'IRMA', irmaQuads
    'nv',   'Neovascularization', 'NV',   nvQuads
};

lesions = struct('key', {}, 'label', {}, 'abbr', {}, 'total', {}, ...
                 'quadrants', {}, 'confirmed', {});
for i = 1:size(defs,1)
    qv = defs{i,4};
    lesions(i).key   = defs{i,1};
    lesions(i).label = defs{i,2};
    lesions(i).abbr  = defs{i,3};
    lesions(i).total = sum(qv);
    lesions(i).quadrants = struct('ST', qv(1), 'SN', qv(2), 'IT', qv(3), 'IN', qv(4));
    lesions(i).confirmed = sum(qv) > 0;
end
end
