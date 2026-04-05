import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/lib/constants";

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const jobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Job History</h1>
        <Link
          href="/compress"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
        >
          New Compression
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400 mb-4">No compression jobs yet.</p>
          <Link
            href="/compress"
            className="text-blue-400 hover:text-blue-300"
          >
            Create your first one
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">
                  Model
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">
                  Method
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">
                  Compression
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-gray-400">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const metrics = job.metrics as Record<string, number> | null;
                return (
                  <tr
                    key={job.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/compress/${job.id}`}
                        className="text-white hover:text-blue-400"
                      >
                        {job.sourceModelName || job.sourceModelId}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-400 font-mono text-sm">
                      {job.method}
                      {(job.config as Record<string, string>)?.quant_type &&
                        ` (${(job.config as Record<string, string>).quant_type})`}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${JOB_STATUS_COLORS[job.status] || ""}`}
                      >
                        {JOB_STATUS_LABELS[job.status] || job.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-400 text-sm">
                      {metrics?.compression_ratio
                        ? `${metrics.compression_ratio}x`
                        : "-"}
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-sm">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
