%STARTSERVER Convenience launcher for the RetinoXAI MATLAB backend.
%   Run this script from the prototype/backend folder in MATLAB:
%       >> startServer
%
%   It adds the pipeline package to the path and starts the REST server on
%   port 8080. The React frontend (prototype/frontend) proxies /api to it.

thisDir = fileparts(mfilename('fullpath'));
addpath(thisDir);

PORT = 8080;

RetinoXAIServer(PORT);
