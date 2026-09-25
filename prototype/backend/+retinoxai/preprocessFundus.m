function [Iout, Ienh] = preprocessFundus(I)
%PREPROCESSFUNDUS Adaptive fundus enhancement (Stage 2 of the pipeline).
%   [Iout, Ienh] = preprocessFundus(I) applies the RetinoXAI enhancement
%   chain used during training:
%       1. Fundus masking
%       2. Illumination normalization (LAB L-channel, Gaussian background)
%       3. CLAHE (adaptive histogram equalization)
%       4. Anisotropic diffusion (edge-preserving denoise)
%   Iout is resized to the model input size; Ienh is the full-resolution
%   enhanced image (used for display / Grad-CAM overlays).
%
%   This mirrors the preprocessing in scripts/preprocess_IDRiD_APTOS.m.

cfg = retinoxai.frozenConfig();

% Ensure RGB uint8
if size(I,3) == 1
    I = repmat(I, [1 1 3]);
end
I = im2uint8(I);

% Fundus mask
Igray = rgb2gray(I);
mask  = Igray > 10;

% RGB -> LAB
ILab = rgb2lab(I);
L = ILab(:,:,1) / 100;

% Illumination normalization
background = imgaussfilt(L, 30);
if any(mask(:))
    meanBackground = mean(background(mask));
else
    meanBackground = mean(background(:));
end
Lnorm = L - background + meanBackground;
Lnorm = max(0, min(1, Lnorm));
Lnorm(~mask) = 0;

% CLAHE
Lclahe = adapthisteq(Lnorm, 'NumTiles', [8 8], 'ClipLimit', 0.01);
Lclahe(~mask) = 0;

% Anisotropic diffusion
Ldiff = imdiffusefilt(Lclahe, 'NumberOfIterations', 5, 'GradientThreshold', 10);
Ldiff(~mask) = 0;

% Reconstruct RGB
ILabDiff = ILab;
ILabDiff(:,:,1) = Ldiff * 100;
Ienh = im2uint8(lab2rgb(ILabDiff));

% Resize for the CNN backbones
Iout = imresize(Ienh, cfg.inputSize(1:2));

end
