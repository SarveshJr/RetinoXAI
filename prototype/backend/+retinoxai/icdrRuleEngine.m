function rule = icdrRuleEngine(lesions, aiGrade)
%ICDRRULEENGINE ICDR 4:2:1 rule cross-check (Stage 5).
%   rule = icdrRuleEngine(lesions, aiGrade) applies the International Clinical
%   DR 4:2:1 rule to the per-quadrant lesion counts and compares the resulting
%   rule grade against the AI grade.
%
%   4:2:1 severe-NPDR boundary:
%       * severe intraretinal haemorrhages/MA in all 4 quadrants, OR
%       * venous beading in >= 2 quadrants, OR
%       * IRMA in >= 1 quadrant.
%   Any neovascularization implies proliferative DR (grade 4).

byKey = containers.Map();
for i = 1:numel(lesions)
    byKey(lesions(i).key) = lesions(i);
end

qnames = {'ST','SN','IT','IN'};

    function v = quadVal(key, q)
        v = 0;
        if isKey(byKey, key)
            v = byKey(key).quadrants.(q);
        end
    end

% Haem + MA burden per quadrant (>= 5 counts as "severe" in that quadrant)
heavy = 0;
for k = 1:4
    if (quadVal('hem', qnames{k}) + quadVal('ma', qnames{k})) >= 5
        heavy = heavy + 1;
    end
end
haemMA4 = heavy >= 4;

vbCount = 0; irmaCount = 0;
for k = 1:4
    if quadVal('vb', qnames{k})   > 0, vbCount = vbCount + 1;   end
    if quadVal('irma', qnames{k}) > 0, irmaCount = irmaCount + 1; end
end
venousBeading2 = vbCount >= 2;
irma1 = irmaCount >= 1;

nvTotal = 0;
if isKey(byKey, 'nv'), nvTotal = byKey('nv').total; end

ruleGrade = aiGrade;
if nvTotal > 0
    ruleGrade = 4;
elseif haemMA4 || venousBeading2 || irma1
    ruleGrade = 3;
end

if nvTotal > 0
    note = 'Neovascularization detected -> proliferative (Grade 4).';
elseif haemMA4
    note = '4:2:1 met - severe haemorrhages in >=4 quadrants.';
elseif venousBeading2
    note = '4:2:1 met - venous beading in >=2 quadrants.';
elseif irma1
    note = '4:2:1 met - IRMA in >=1 quadrant.';
else
    note = '4:2:1 threshold not met - consistent with <= moderate NPDR.';
end

rule = struct();
rule.ruleGrade    = ruleGrade;
rule.fourTwoOne   = struct('haemMA4', haemMA4, 'venousBeading2', venousBeading2, 'irma1', irma1);
rule.agreesWithAI = (ruleGrade == aiGrade);
rule.note         = note;
end
