function url = imToDataURL(I)
%IMTODATAURL Encode an image matrix as a base64 PNG data URL.
%   url = imToDataURL(I) returns 'data:image/png;base64,....' suitable for
%   embedding directly in the JSON response consumed by the React frontend.

if isempty(I)
    url = '';
    return
end

tmp = [tempname, '.png'];
imwrite(im2uint8(I), tmp);
fid = fopen(tmp, 'rb');
bytes = fread(fid, Inf, '*uint8');
fclose(fid);
delete(tmp);

b64 = matlab.net.base64encode(bytes);
url = ['data:image/png;base64,', char(b64)];
end
