import { LogoMark } from './Logo'
import { FundusViewer } from '@/components/fundus/FundusViewer'
import { GRADES, FROZEN_CONFIG, MODEL_METRICS, type ScreeningResult } from '@/lib/clinical'
import { CURRENT_DOCTOR } from '@/lib/demoData'
import { formatDateTime } from '@/lib/utils'
import { gradeColor } from './grade'

/** Template-based clinical report (grade + lesion counts + evidence). Print-optimised. */
export function ReportView({ result }: { result: ScreeningResult }) {
  const g = GRADES[result.grade]
  const reportId = `RX-${result.id.slice(-8).toUpperCase()}`
  const signed = result.decision === 'signed-off'
  const finalG = GRADES[result.finalGrade ?? result.grade]

  return (
    <div className="print-report mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <LogoMark size={40} />
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Retino<span className="text-primary">XAI</span> Screening Report
            </p>
            <p className="text-xs text-muted-foreground">
              Explainable AI for Diabetic Retinopathy · SIH26038
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{reportId}</p>
          <p>{CURRENT_DOCTOR.facility}</p>
          <p>{formatDateTime(result.processedAt)}</p>
        </div>
      </div>

      {/* Patient + verdict */}
      <div className="grid gap-5 py-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Patient</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <Field label="Name" value={result.patient.name} />
            <Field label="Patient ID" value={result.patient.id} />
            <Field label="Age / Sex" value={`${result.patient.age} · ${result.patient.sex}`} />
            <Field label="Eye" value={result.eye === 'OD' ? 'Right (OD)' : 'Left (OS)'} />
            <Field label="Diabetes" value={`${result.patient.diabetesYears} years`} />
            <Field label="Location" value={result.patient.village} />
          </div>
        </div>
        <div
          className="flex flex-col items-center justify-center rounded-xl border p-4 text-center"
          style={{ borderColor: `color-mix(in srgb, ${gradeColor(result.grade)} 40%, transparent)` }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Verdict</p>
          <p className="mt-1 text-xl font-semibold" style={{ color: gradeColor(result.grade) }}>
            {g.code}
          </p>
          <p className="text-sm font-medium">{g.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.referable ? 'Referable' : 'Non-referable'} · {result.confidence.toFixed(1)}% confidence
          </p>
        </div>
      </div>

      {/* Imaging */}
      <div className="grid grid-cols-2 gap-3 border-t border-border py-5">
        <figure>
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            <FundusViewer result={result} layer="enhanced" className="aspect-[4/3]" />
          </div>
          <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">
            Enhanced fundus
          </figcaption>
        </figure>
        <figure>
          <div className="overflow-hidden rounded-lg border border-border bg-black">
            <FundusViewer result={result} layer="gradcam" opacity={0.8} className="aspect-[4/3]" />
          </div>
          <figcaption className="mt-1.5 text-center text-xs text-muted-foreground">
            Grad-CAM++ evidence
          </figcaption>
        </figure>
      </div>

      {/* Findings */}
      <div className="grid gap-5 border-t border-border py-5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lesion findings
          </p>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {result.lesions
                .filter((l) => l.total > 0)
                .map((l) => (
                  <tr key={l.key} className="border-b border-border/60">
                    <td className="py-1 text-muted-foreground">{l.label}</td>
                    <td className="py-1 text-right tabular font-medium">{l.total}</td>
                  </tr>
                ))}
              {result.lesions.every((l) => l.total === 0) && (
                <tr>
                  <td className="py-1 text-muted-foreground">No significant lesions detected</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quality & validation
          </p>
          <div className="mt-2 space-y-1.5 text-sm">
            <Field label="FundaQ-8 score" value={`${result.quality.total} / 16 (${result.quality.passed ? 'accepted' : 'enhanced'})`} />
            <Field
              label="ICDR 4:2:1 rule"
              value={result.rule.agreesWithAI ? 'Agrees with AI' : `Flagged → ${GRADES[result.rule.ruleGrade].short}`}
            />
            <Field label="Referable probability" value={`${(result.ensemble.referableProb * 100).toFixed(1)}%`} />
            <Field label="Decision" value={result.rule.note} />
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-lg border-l-4 bg-secondary/40 p-4" style={{ borderColor: gradeColor(result.grade) }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recommendation
        </p>
        <p className="mt-1 text-sm font-medium">{g.action}</p>
      </div>

      {/* Sign-off + footer */}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Reviewing clinician
          </p>
          {signed ? (
            <>
              <p className="mt-2 text-sm font-medium">{result.reviewedBy}</p>
              <p className="text-xs text-muted-foreground">
                {CURRENT_DOCTOR.role} · Reg. {CURRENT_DOCTOR.regNo}
              </p>
              <p className="mt-1 text-xs text-safe">✓ Signed · final grade {finalG.code}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground italic">Awaiting doctor sign-off</p>
          )}
        </div>
        <div className="text-right text-[10px] text-muted-foreground">
          <p>
            Ensemble ResNet-50 {FROZEN_CONFIG.resnetWeight} / EfficientNet-B5 {FROZEN_CONFIG.efficientNetWeight}
          </p>
          <p>
            Referable threshold {FROZEN_CONFIG.referableThreshold} · Sens {MODEL_METRICS.sensitivity}% · Spec{' '}
            {MODEL_METRICS.specificity}%
          </p>
          <p className="mt-1">Clinical decision-support tool · not a substitute for examination.</p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
