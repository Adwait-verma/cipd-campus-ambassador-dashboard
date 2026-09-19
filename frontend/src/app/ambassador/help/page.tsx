"use client";

import { authFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type HelpContact = {
  contact_email: string | null;
  phone_number: string | null;
};

export default function AmbassadorHelpPage() {
  const [contact, setContact] = useState<HelpContact | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("http://127.0.0.1:8000/ambassador/help-contact")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Could not load contact details.");
        setContact(data);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Could not load contact details.")
      );
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#238C89]">Support</p>
      <h1 className="mt-2 text-3xl font-bold text-[#202629]">Help &amp; programme contact</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
        Contact the CiPD programme team if you need help with a campaign, submission, social-account verification, or your profile.
      </p>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        {!contact && !error && <p className="text-gray-600">Loading contact details...</p>}
        {error && <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}
        {contact && !contact.contact_email && !contact.phone_number && (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            The programme contact has not been added yet. Please check again later.
          </p>
        )}
        {contact?.contact_email && (
          <div className="border-b border-gray-100 pb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Email</p>
            <a href={`mailto:${contact.contact_email}`} className="mt-2 inline-block text-lg font-semibold text-[#238C89] hover:underline">
              {contact.contact_email}
            </a>
          </div>
        )}
        {contact?.phone_number && (
          <div className={contact.contact_email ? "pt-6" : ""}>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">Phone</p>
            <a href={`tel:${contact.phone_number}`} className="mt-2 inline-block text-lg font-semibold text-[#238C89] hover:underline">
              {contact.phone_number}
            </a>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#D5EBE9] bg-[#F1FAF9] p-6">
        <h2 className="font-bold text-[#202629]">Before contacting support</h2>
        <p className="mt-2 text-sm leading-6 text-gray-700">
          Include the campaign name and the email used for your account. Never send your password or a social-platform access token.
        </p>
      </section>
    </div>
  );
}
