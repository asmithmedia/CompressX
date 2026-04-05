import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/lib/constants";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const recentJobs = await prisma.job.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const jobCount = await prisma.job.count({
    where: { userId: session.user.id },
  });

  const completedCount = await prisma.job.count({
    where: { userId: session.user.id, status: "COMPLETED" },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Welcome back, {session.user.name || "Developer"}
          </p>
        </div>
        <Link
          href="/compress"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
        >
          New Compression
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-400">Total Jobs</div>
          <div className="text-3xl font-bold text-white mt-1">{jobCount}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-400">Completed</div>
          <div className="text-3xl font-bold text-green-400 mt-1">
            {completedCount}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="text-sm text-gray-400">Free Jobs Left</div>
          <div className="text-3xl font-bold text-blue-400 mt-1">
            {Math.max(0, 3 - jobCount)}
          </div>
        </div>
      </div>

      {/* Quick start */}
      {jobCount === 0 && (
        <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-xl p-8 mb-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            Ready to compress your first model?
          </h2>
          <p className="text-gray-400 mb-4">
            Search HuggingFace for a model, pick a quantization level, and get a
            compressed GGUF file in minutes.
          </p>
          <Link
            href="/compress"
            className="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition"
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Jobs</h2>
            <Link
              href="/history"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </div>
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
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
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
                    <td className="px-6 py-3 text-gray-500 text-sm">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
