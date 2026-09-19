"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type Activity = {
  activity_id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  summary: string;
  created_at: string;
  admin_name: string | null;
  admin_email: string | null;
};

function actionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("http://127.0.0.1:8000/admin/activity-logs?limit=200")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load activity history.");
        setActivities(data.activities || []);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Could not load activity history.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#9383D8]">Administration</p>
      <h1 className="mt-2 text-3xl font-bold text-[#202629]">Activity log</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">
        Review important admin actions such as campaign publication, metric verification, rating calculation, contact changes, CSV exports, and ambassador emails.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading && <p className="p-7 text-gray-600">Loading activity history...</p>}
        {error && <p className="m-7 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
        {!loading && !error && activities.length === 0 && (
          <p className="p-7 text-gray-600">No recorded admin activity yet. New actions will appear here.</p>
        )}
        {activities.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-[#F5F7F7] text-xs uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="px-6 py-4">Date and time</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Administrator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activities.map((activity) => (
                  <tr key={activity.activity_id} className="align-top">
                    <td className="whitespace-nowrap px-6 py-5 text-gray-600">
                      {new Date(activity.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-5">
                      <span className="rounded-full bg-[#F0EDFB] px-3 py-1 text-xs font-semibold text-[#6855B5]">
                        {actionLabel(activity.action)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-gray-700">
                      <p>{activity.summary}</p>
                      {activity.entity_type && (
                        <p className="mt-1 text-xs text-gray-500">
                          {activity.entity_type}{activity.entity_id ? ` #${activity.entity_id}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#202629]">{activity.admin_name || "Former administrator"}</p>
                      {activity.admin_email && <p className="mt-1 text-xs text-gray-500">{activity.admin_email}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="mt-4 text-xs leading-5 text-gray-500">The page displays the latest 200 recorded actions. Passwords, access tokens, and email message bodies are never stored in this log.</p>
    </div>
  );
}
