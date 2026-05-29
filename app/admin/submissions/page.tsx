import Link from "next/link";

const sampleSubmissions = [
  {
    id: "demo-001",
    name: "Alex Rivera",
    goal: "Build strength while training around knee discomfort",
    status: "Ready for review",
    submittedAt: "May 29, 2026",
  },
  {
    id: "demo-002",
    name: "Jordan Lee",
    goal: "Improve conditioning for a fall trail race",
    status: "Needs triage",
    submittedAt: "May 28, 2026",
  },
  {
    id: "demo-003",
    name: "Sam Patel",
    goal: "Return to consistent training after travel",
    status: "Draft plan queued",
    submittedAt: "May 27, 2026",
  },
];

export default function AdminSubmissionsPage() {
  return (
    <main className="page-shell">
      {/* TODO: Protect this admin route with authentication, authorization, and RBAC before sharing the URL publicly. */}
      <section className="warning-panel">
        <strong>Admin security TODO:</strong> This v1 admin area has no auth or RBAC because Mario
        requested no roles yet. Protect these pages before sharing the URL publicly.
      </section>

      <section className="hero-panel">
        <p className="eyebrow">Admin</p>
        <h1>Coaching intake submissions</h1>
        <p>
          Review incoming coaching intakes, triage details, and open individual submission records.
          The data below is placeholder content until the repository is connected to these pages.
        </p>
      </section>

      <section className="card stack">
        <div className="section-heading">
          <h2>Recent submissions</h2>
          <span>{sampleSubmissions.length} demo records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Goal summary</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {sampleSubmissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.name}</td>
                  <td>{submission.goal}</td>
                  <td>{submission.status}</td>
                  <td>{submission.submittedAt}</td>
                  <td>
                    <Link href={`/admin/submissions/${submission.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
