function RetinoXAIServer(port)
%RETINOXAISERVER Pure-MATLAB REST backend for the RetinoXAI clinician app.
%
%   RetinoXAIServer(port) starts a lightweight HTTP/1.1 server built on the
%   Java runtime that ships with MATLAB (java.net.ServerSocket) - no extra
%   web toolbox required. It runs the trained ResNet-50 + EfficientNet-B5
%   ensemble pipeline (see the +retinoxai package) and returns JSON.
%
%   Endpoints:
%       GET  /api/health   engine status + frozen config
%       POST /api/screen   { patient, eye, imageBase64 } -> ScreeningResult
%       POST /api/signoff  { id, finalGrade, note, reviewedBy } -> { ok }
%       GET  /api/worklist -> [] (session worklist is held client-side)
%       GET  /api/analytics-> digital-twin + validation metrics
%       *    static files   served from ../frontend/dist when built
%
%   Usage:
%       cd prototype/backend
%       RetinoXAIServer            % defaults to port 8080
%       RetinoXAIServer(8080)
%
%   Stop with Ctrl+C.

if nargin < 1, port = 8080; end

% Make the +retinoxai package importable and warm the models.
here = fileparts(mfilename('fullpath'));
addpath(here);
cfg = retinoxai.frozenConfig();
fprintf('\n=============================================\n');
fprintf(' RetinoXAI MATLAB backend\n');
fprintf('=============================================\n');
fprintf(' Model: %s\n', cfg.modelVersion);
fprintf(' Build: %s   <-- verify this matches the expected build\n', cfg.buildTag);
fprintf(' Ensemble: ResNet-50 %.2f / EfficientNet-B5 %.2f · threshold %.2f\n', ...
    cfg.resnetWeight, cfg.efficientNetWeight, cfg.referableThreshold);
try
    retinoxai.loadModels(cfg);   % prints its own detailed backbone status
catch ME
    fprintf(2, ' Inference: ESTIMATE fallback (model load error: %s)\n', ME.message);
end

serverSocket = java.net.ServerSocket(port);
serverSocket.setReuseAddress(true);
fprintf('\n Listening on http://localhost:%d\n', port);
fprintf(' Frontend dev server proxies /api here (see vite.config.ts)\n');
fprintf(' Press Ctrl+C to stop.\n\n');

cleaner = onCleanup(@() serverSocket.close());

dbgFile = fullfile(tempdir, 'retinoxai_debug.log');
dbg(dbgFile, 'server started, listening on %d', port);

while true
    client = serverSocket.accept();  % blocks until a connection arrives
    dbg(dbgFile, 'connection accepted');
    try
        handleClient(client, cfg, here, dbgFile);
    catch ME
        dbg(dbgFile, 'ERROR: %s', ME.message);
        fprintf(2, '[RetinoXAI] request error: %s\n', ME.message);
        try, sendResponse(client, 500, 'application/json', ...
                jsonencode(struct('error', ME.message))); catch, end
    end
    try, client.close(); catch, end
end
end

% ==================================================================
function dbg(file, fmt, varargin)
%DBG Append a timestamped line to a debug log, flushed immediately.
try
    fid = fopen(file, 'a');
    if fid > 0
        fprintf(fid, '[%s] %s\n', datestr(now, 'HH:MM:SS.FFF'), sprintf(fmt, varargin{:}));
        fclose(fid);
    end
catch
end
end

% ==================================================================
function handleClient(client, cfg, rootDir, dbgFile)
if nargin < 4, dbgFile = fullfile(tempdir, 'retinoxai_debug.log'); end
[method, path, ~, body] = readRequest(client);
dbg(dbgFile, 'parsed method="%s" path="%s" bodyBytes=%d', method, path, numel(body));
if isempty(method)
    return
end
fprintf('[RetinoXAI] %s %s (%d bytes body)\n', method, path, numel(body));

% CORS preflight
if strcmpi(method, 'OPTIONS')
    sendResponse(client, 204, 'text/plain', '');
    return
end

% Strip query string
qpos = strfind(path, '?');
if ~isempty(qpos), path = path(1:qpos(1)-1); end

switch true
    case strcmpi(path, '/api/health')
        health = struct( ...
            'status', 'online', 'source', 'live', 'engine', matlabEngineName(), ...
            'modelVersion', cfg.modelVersion, 'build', cfg.buildTag, ...
            'config', struct('resnetWeight', cfg.resnetWeight, ...
                'efficientNetWeight', cfg.efficientNetWeight, ...
                'referableThreshold', cfg.referableThreshold));
        sendResponse(client, 200, 'application/json', jsonencode(health));

    case strcmpi(path, '/api/screen') && strcmpi(method, 'POST')
        req = jsondecode(body);
        [I, hasImg] = decodeImage(req);
        if ~hasImg
            sendResponse(client, 400, 'application/json', ...
                jsonencode(struct('error', 'imageBase64 required for live inference')));
            return
        end
        patient = getfielddef(req, 'patient', struct());
        eye = getfielddef(req, 'eye', 'OD');
        qualityOverride = getfielddef(req, 'quality', []);
        result = retinoxai.runPipeline(I, patient, eye, qualityOverride);
        sendResponse(client, 200, 'application/json', jsonencode(result));

    case strcmpi(path, '/api/signoff') && strcmpi(method, 'POST')
        sendResponse(client, 200, 'application/json', jsonencode(struct('ok', true)));

    case strcmpi(path, '/api/worklist')
        sendResponse(client, 200, 'application/json', '[]');

    case strcmpi(path, '/api/analytics')
        sendResponse(client, 200, 'application/json', jsonencode(analyticsPayload(cfg)));

    otherwise
        serveStatic(client, path, rootDir);
end
end

% ==================================================================
function [method, path, headers, body] = readRequest(client)
method = ''; path = ''; headers = containers.Map('KeyType','char','ValueType','char'); body = '';

% All reads go through a blocking DataInputStream. readByte()/readFully()
% genuinely block for data, so this works on Windows JVMs where
% InputStream.available() spuriously returns 0 (the old empty-reply bug).
% Header bytes are read one at a time (headers are small) until the
% CRLF-CRLF separator; the body is then read in bulk via readFully. A socket
% timeout guards against a client that connects but never sends.
try, client.setSoTimeout(15000); catch, end

in = client.getInputStream();
dis = java.io.DataInputStream(java.io.BufferedInputStream(in));

% --- Read header bytes until the "\r\n\r\n" separator ---
hdr = uint8([]);
gotSep = false;
while true
    try
        b = dis.readByte();              % blocks; throws EOFException at end
    catch
        break                            % EOF or socket timeout
    end
    hdr(end+1) = typecast(int8(b), 'uint8'); %#ok<AGROW>
    n = numel(hdr);
    if n >= 4 && hdr(n-3)==13 && hdr(n-2)==10 && hdr(n-1)==13 && hdr(n)==10
        gotSep = true;
        break
    end
    if n > 65536, break; end             % runaway-header guard
end
if ~gotSep || numel(hdr) < 4
    return
end

hdrText = char(hdr(1:end-4));            % strip trailing CRLFCRLF
[method, path, headers] = parseHeaders(hdrText);
contentLen = 0;
if isKey(headers, 'content-length')
    contentLen = str2double(headers('content-length'));
end

% --- Read the body: exactly contentLen bytes, then decode as UTF-8 ---
% Use commons-io IOUtils.toByteArray, which reads the bytes and RETURNS the
% array entirely on the Java side. Filling a MATLAB-created array in place
% (readFully / read into a buffer) does not work under MATLAB's Java 8 bridge
% (it marshals primitive arrays by value, so the fill is lost and the body
% came back all-zero); a returned array marshals correctly. Bounded by
% contentLen, so it is safe on keep-alive connections that never reach EOF.
if contentLen > 0
    jb = org.apache.commons.io.IOUtils.toByteArray(dis, int64(contentLen));
    bytes = typecast(jb, 'uint8');
    body = native2unicode(bytes(:)', 'UTF-8');
end
end

function [method, path, headers] = parseHeaders(hdrText)
headers = containers.Map('KeyType','char','ValueType','char');
lines = strsplit(hdrText, sprintf('\r\n'));
parts = strsplit(strtrim(lines{1}), ' ');
method = parts{1};
if numel(parts) >= 2, path = parts{2}; else, path = '/'; end
for i = 2:numel(lines)
    ln = lines{i};
    c = strfind(ln, ':');
    if ~isempty(c)
        key = lower(strtrim(ln(1:c(1)-1)));
        val = strtrim(ln(c(1)+1:end));
        headers(key) = val;
    end
end
end

% ==================================================================
function [I, hasImg] = decodeImage(req)
I = []; hasImg = false;
if ~isfield(req, 'imageBase64') || isempty(req.imageBase64)
    return
end
data = req.imageBase64;
comma = strfind(data, ',');
if ~isempty(comma) && contains(extractBefore(data, comma(1)+1), 'base64')
    data = data(comma(1)+1:end);
end
try
    bytes = matlab.net.base64decode(data);
    tmp = [tempname, '.img'];
    fid = fopen(tmp, 'wb'); fwrite(fid, bytes, 'uint8'); fclose(fid);
    I = imread(tmp);
    delete(tmp);
    hasImg = true;
catch ME
    fprintf(2, '[RetinoXAI] image decode failed: %s\n', ME.message);
end
end

% ==================================================================
function serveStatic(client, path, rootDir)
distDir = fullfile(rootDir, '..', 'frontend', 'dist');
if strcmp(path, '/') || isempty(path)
    path = '/index.html';
end
localPath = fullfile(distDir, strrep(path, '/', filesep));
if isfile(localPath)
    bytes = readBytes(localPath);
    sendBytes(client, 200, guessType(localPath), bytes);
elseif isfile(fullfile(distDir, 'index.html'))
    % SPA fallback
    bytes = readBytes(fullfile(distDir, 'index.html'));
    sendBytes(client, 200, 'text/html', bytes);
else
    msg = ['<h2>RetinoXAI MATLAB backend</h2>' ...
           '<p>API is running. Build the frontend (npm run build) to serve it here, ' ...
           'or run the Vite dev server which proxies <code>/api</code> to this port.</p>'];
    sendResponse(client, 200, 'text/html', msg);
end
end

% ==================================================================
function sendResponse(client, status, contentType, bodyStr)
sendBytes(client, status, contentType, unicode2native(bodyStr, 'UTF-8'));
end

function sendBytes(client, status, contentType, bodyBytes)
statusText = statusPhrase(status);
header = sprintf([ ...
    'HTTP/1.1 %d %s\r\n' ...
    'Content-Type: %s\r\n' ...
    'Content-Length: %d\r\n' ...
    'Access-Control-Allow-Origin: *\r\n' ...
    'Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n' ...
    'Access-Control-Allow-Headers: Content-Type\r\n' ...
    'Connection: close\r\n\r\n'], status, statusText, contentType, numel(bodyBytes));
out = client.getOutputStream();
out.write(unicode2native(header, 'UTF-8'));
if ~isempty(bodyBytes)
    out.write(typecast(uint8(bodyBytes(:)'), 'int8'));
end
out.flush();
end

% ==================================================================
function v = getfielddef(s, f, d)
if isstruct(s) && isfield(s, f) && ~isempty(s.(f)), v = s.(f); else, v = d; end
end

function name = matlabEngineName()
name = ['MATLAB ', version('-release')];
end

function bytes = readBytes(p)
fid = fopen(p, 'rb'); bytes = fread(fid, Inf, '*uint8'); fclose(fid);
end

function t = guessType(p)
[~,~,ext] = fileparts(lower(p));
switch ext
    case '.html', t = 'text/html';
    case '.js',   t = 'application/javascript';
    case '.css',  t = 'text/css';
    case '.json', t = 'application/json';
    case '.svg',  t = 'image/svg+xml';
    case '.png',  t = 'image/png';
    case {'.jpg','.jpeg'}, t = 'image/jpeg';
    case '.woff2', t = 'font/woff2';
    case '.woff',  t = 'font/woff';
    otherwise, t = 'application/octet-stream';
end
end

function s = statusPhrase(code)
switch code
    case 200, s = 'OK';
    case 204, s = 'No Content';
    case 400, s = 'Bad Request';
    case 404, s = 'Not Found';
    case 500, s = 'Internal Server Error';
    otherwise, s = 'OK';
end
end

function p = analyticsPayload(cfg)
p = struct( ...
    'patientsPerHour', 62, 'totalHandled', 524, 'sessionHours', 8, ...
    'arrivalIntervalSec', 55, 'aiProcessingSec', [5 10], 'reviewSec', [60 180], ...
    'avgTurnaroundSec', 52, ...
    'bandwidth', struct('offlineFirst', true, 'reportSizeMbit', 1.6, ...
        'note', 'Grading runs on local hardware; reports buffer and sync when the uplink recovers.'), ...
    'district', struct('targetPerYear', 100000, 'patientsPerUnitPerDay', 500, ...
        'workingDaysPerYear', 260, 'defaultUnits', 10), ...
    'metrics', cfg.metrics);
end
