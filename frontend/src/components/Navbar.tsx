export default function Navbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div>
        <p className="text-sm font-medium text-gray-400">
          CiPD Campus Ambassador Portal
        </p>
      </div>

      <div className="flex items-center gap-5">
        {/* Notification */}
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50">
          <span className="text-lg">●</span>
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E98AAE]" />
        </button>

        {/* User */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-5">
          <div className="text-right">
            <p className="text-sm font-semibold text-[#202629]">
              Aarav Mehta
            </p>
            <p className="text-xs text-gray-400">IIIT Delhi</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#54B9B4] font-bold text-white">
            AM
          </div>
        </div>
      </div>
    </header>
  );
}