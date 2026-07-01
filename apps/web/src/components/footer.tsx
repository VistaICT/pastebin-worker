export default function Footer() {
  return (
    <footer className="shrink-0">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-3 text-xs text-gray-500 dark:text-gray-600">
        &copy; {new Date().getFullYear()} Vista. All rights reserved.
      </div>
    </footer>
  );
}
