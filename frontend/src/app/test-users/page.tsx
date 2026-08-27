"use client";

import { useEffect, useState } from "react";

type User = {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
};

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/test-users")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        return response.json();
      })
      .then((data) => {
        setUsers(data.users);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <main className="p-8">Loading users...</main>;
  }

  if (error) {
    return <main className="p-8 text-red-500">Error: {error}</main>;
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="mb-6 text-3xl font-bold">
        CIPD Ambassador Dashboard
      </h1>

      <h2 className="mb-4 text-xl font-semibold">
        Users from FastAPI
      </h2>

      <div className="space-y-4">
        {users.map((user) => (
          <div
            key={user.user_id}
            className="rounded-lg border p-4"
          >
            <p className="font-semibold">{user.full_name}</p>
            <p>{user.email}</p>
            <p className="text-gray-500">{user.role}</p>
          </div>
        ))}
      </div>
    </main>
  );
}