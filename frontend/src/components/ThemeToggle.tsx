"use client";
import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("velyrion_theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("velyrion_theme", next);
    if (next === "dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  // Avoid hydration mismatch
  if (!mounted) return null;

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme">
      <span style={{
        display: "inline-block",
        transition: "transform 0.3s ease",
        transform: theme === "dark" ? "rotate(0deg)" : "rotate(360deg)",
        fontSize: 14,
      }}>
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
