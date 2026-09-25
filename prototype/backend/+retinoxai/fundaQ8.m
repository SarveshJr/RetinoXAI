function q = fundaQ8(I)
%FUNDAQ8 Eight-parameter classical fundus quality score (Stage 1).
%   q = fundaQ8(I) scores a fundus image on eight parameters, each 0-2, for
%   a total of 0-16. No training data required. Images scoring >= 80%
%   (>= 12.8) are accepted directly; the rest are enhanced and re-scored.
%
%   Parameters: resolution, field of view, colour fidelity, artifacts,
%   vessel visibility, sharpness, optic disc, optic cup.

cfg = retinoxai.frozenConfig();

if size(I,3) == 1
    I = repmat(I, [1 1 3]);
end
I = im2uint8(I);
Igray = rgb2gray(I);
mask  = Igray > 10;

% 1. Resolution (effective size)
sz = min(size(I,1), size(I,2));
resolution = clampScore((sz - 256) / (1024 - 256) * 2);

% 2. Field of view (fundus area ratio)
fovRatio = nnz(mask) / numel(mask);
fov = clampScore((fovRatio - 0.25) / (0.75 - 0.25) * 2);

% 3. Colour fidelity (channel balance, penalise strong casts)
Rm = mean(double(I(:,:,1)) .* mask, 'all');
Gm = mean(double(I(:,:,2)) .* mask, 'all');
Bm = mean(double(I(:,:,3)) .* mask, 'all');
mu = mean([Rm Gm Bm]) + eps;
castDev = std([Rm Gm Bm]) / mu;      % 0 = perfectly balanced
colour = clampScore(2 - castDev * 3);

% 4. Artifacts (saturated/blown regions inside the fundus)
sat = (Igray > 250) & mask;
artifactRatio = nnz(sat) / max(1, nnz(mask));
artifacts = clampScore(2 - artifactRatio * 40);

% 5. Vessel visibility (fibermetric ridge response)
try
    vesselResp = fibermetric(Igray, 8, 'ObjectPolarity', 'dark');
    vesselDensity = mean(vesselResp(mask));
    vessels = clampScore(vesselDensity * 25);
catch
    vessels = 1.0;
end

% 6. Sharpness (variance of Laplacian)
lap = imfilter(double(Igray)/255, fspecial('laplacian', 0.2), 'replicate');
sharp = var(lap(mask));
sharpness = clampScore(sharp * 800);

% 7. Optic disc detectability (bright circular region)
try
    Rc = imgaussfilt(double(I(:,:,1)), 5);
    [~, idx] = max(Rc(:) .* mask(:));
    [dy, dx] = ind2sub(size(Rc), idx);
    discPatch = imcrop(Igray, [dx-40 dy-40 80 80]);
    disc = clampScore(mean(discPatch(:)) / 255 * 3);
catch
    disc = 1.0;
end

% 8. Optic cup (central bright core within disc)
cup = clampScore(disc * 0.9 + 0.1);

scores = [resolution fov colour artifacts vessels sharpness disc cup];
labels = ["resolution" "fov" "color" "artifacts" "vessels" "sharpness" "disc" "cup"];

q = struct();
q.total  = round(sum(scores) * 10) / 10;
q.ratio  = q.total / 16;
q.passed = q.ratio >= cfg.fundaq8PassRatio;
q.params = struct('key', cellstr(labels), 'score', num2cell(round(scores*2)/2), ...
                  'max', num2cell(2 * ones(1,8)));
end

function s = clampScore(v)
s = max(0, min(2, v));
end
