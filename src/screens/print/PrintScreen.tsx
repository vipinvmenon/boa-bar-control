/**
 * BAR-092 — the paper fallback.
 *
 * Specification phase 2 ends with "Paper sheets printed", and §15's whole
 * contingency is that "Phases 1–2 with paper counts ... still produces a
 * defensible audit". If every phone is flat or the venue has no signal, this is
 * what the night runs on. It has to be printed BEFORE load-in, because a system
 * that can only print while it is working is not a fallback.
 *
 * Two things govern the design of these sheets, and both override looking good:
 *
 *   1. **No quantity appears anywhere.** Not an expected figure, not a previous
 *      count, not a par level. A printed sheet goes to the person counting, and a
 *      number on paper defeats blind counting exactly as a number on screen does —
 *      worse, because a sheet cannot be un-printed once it is in a folder.
 *   2. **Two names on every sheet.** Specification §5 and §6 both turn on a second
 *      person: a docket is worthless without two parties, and a count is sealed by
 *      a counter and a witness. Paper has to carry what the database would.
 *
 * Not a design screen — the approved design has no print view. It is deliberately
 * plain: black on white, ruled boxes, nothing that costs toner or fails on a bad
 * printer in a production office.
 */
import { useRepositoryQuery } from '../../data/RepositoryProvider'

/** A ruled box to write in. Width is set by the column, not by content. */
function WriteBox({ label }: { label?: string }) {
  return (
    <span className="pw-box">
      {label ? <em>{label}</em> : null}
    </span>
  )
}

function SignatureBlock({ roles }: { roles: [string, string] }) {
  return (
    <div className="pw-signatures">
      {roles.map((role) => (
        <div key={role}>
          <span className="pw-sig-role">{role}</span>
          <span className="pw-sig-line" />
          <span className="pw-sig-caption">NAME / SIGNATURE / TIME</span>
        </div>
      ))}
    </div>
  )
}

export function PrintScreen() {
  const pack = useRepositoryQuery(['printPack'], (r) => r.printPack())
  const data = pack.data

  if (!data) {
    return <div className="screen"><p className="section-empty">Preparing the pack…</p></div>
  }

  return (
    <div className="print-root">
      {/* On screen only: the button and the warning. Hidden when printing. */}
      <div className="pw-toolbar">
        <div>
          <strong>PAPER FALLBACK PACK</strong>
          <p>
            {data.sheets.length} count sheets and one blank docket. Print before load-in — a
            fallback you can only produce while the system works is not a fallback.
          </p>
          <p className="pw-warn">
            No quantities appear on these sheets. That is deliberate: a printed expected figure
            defeats blind counting, and a sheet cannot be un-printed.
          </p>
        </div>
        <button className="flow-cta" onClick={() => window.print()}>Print</button>
      </div>

      {data.sheets.map((sheet) => (
        <section className="pw-sheet" key={sheet.locationId}>
          <header className="pw-head">
            <div>
              <h1>COUNT SHEET · {sheet.locationName}</h1>
              <p>{data.venueName} · {data.eventDate}</p>
            </div>
            <div className="pw-head-meta">
              <span>COUNT TYPE <WriteBox label="OPENING / MID / CLOSE" /></span>
              <span>TIME STARTED <WriteBox /></span>
            </div>
          </header>

          <table className="pw-table">
            <thead>
              <tr>
                <th className="pw-col-product">PRODUCT</th>
                <th className="pw-col-num">FULL</th>
                <th className="pw-col-num">PARTIAL</th>
                <th className="pw-col-num">EMPTIES</th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((line) => (
                <tr key={line.skuId}>
                  <td>
                    <strong>{line.name}</strong>
                    <small>{line.spec}</small>
                  </td>
                  <td />
                  {/* The unit is printed so nobody has to remember that a keg is
                      litres and a spirit is millilitres at 02:00. */}
                  <td className="pw-unit">{line.partialUnit}</td>
                  <td />
                </tr>
              ))}
            </tbody>
          </table>

          {/*
            The selected V1 rule is to record returnable empties per location during
            close-out. Storage and the responsible person are written in the note
            space below, so the observation survives even if the app is offline.
          */}
          <p className="pw-note">
            EMPTIES: count returnable empties in the close-out pass. Note the storage location
            and responsible person here; this observation cannot be reconstructed afterwards.
          </p>

          <SignatureBlock roles={['COUNTED BY', 'WITNESSED BY']} />
        </section>
      ))}

      {/* A blank docket, for a transfer made while the app is unavailable. */}
      <section className="pw-sheet">
        <header className="pw-head">
          <div>
            <h1>DOCKET · TRANSFER OF CUSTODY</h1>
            <p>{data.venueName} · {data.eventDate}</p>
          </div>
          <div className="pw-head-meta">
            <span>DOCKET NO <WriteBox /></span>
            <span>TIME <WriteBox /></span>
          </div>
        </header>

        <div className="pw-route">
          <span>FROM <WriteBox /></span>
          <span>TO <WriteBox /></span>
        </div>

        <table className="pw-table">
          <thead>
            <tr>
              <th className="pw-col-product">PRODUCT</th>
              <th className="pw-col-num">ISSUED</th>
              <th className="pw-col-num">RECEIVED</th>
              <th className="pw-col-num">SHORT</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, i) => (
              <tr key={i}><td /><td /><td /><td /></tr>
            ))}
          </tbody>
        </table>

        <p className="pw-note">
          A shortfall needs a reason written here, and both names below. A docket signed by one
          person records nothing — that is the whole point of the second signature.
        </p>
        <p className="pw-reason">REASON IF SHORT <span className="pw-sig-line" /></p>

        <SignatureBlock roles={['ISSUED BY', 'ACCEPTED BY']} />
      </section>
    </div>
  )
}
