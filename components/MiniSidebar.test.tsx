/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MiniSidebar from "./MiniSidebar";
import { LayoutDashboard, Users, Settings } from "lucide-react";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// ─── Test Data ────────────────────────────────────────────────────────────────

const testItems = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={20} />, end: true },
  { href: "/users", label: "Users", icon: <Users size={20} /> },
  { href: "/settings", label: "Settings", icon: <Settings size={20} /> },
];

const testSections = [
  {
    label: "Reports",
    icon: <Settings size={20} />,
    subItems: [
      { href: "/reports/sales", label: "Sales Report" },
      { href: "/reports/leads", label: "Lead Report" },
    ],
  },
];

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("MiniSidebar", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  // 1. Default expanded state
  it("renders expanded by default when localStorage is empty", () => {
    render(<MiniSidebar items={testItems} />);

    const sidebar = screen.getByRole("navigation");
    expect(sidebar).toHaveClass("w-[240px]");
    expect(sidebar).not.toHaveClass("w-[72px]");

    // Labels should be visible
    expect(screen.getByText("Dashboard")).toBeVisible();
    expect(screen.getByText("Users")).toBeVisible();
  });

  // 2. Collapsed state from localStorage
  it("renders collapsed when localStorage has 'true'", () => {
    mockLocalStorage.getItem.mockReturnValue("true");
    render(<MiniSidebar items={testItems} />);

    const sidebar = screen.getByRole("navigation");
    expect(sidebar).toHaveClass("w-[72px]");
    expect(sidebar).toHaveClass("collapsed");
  });

  // 3. Toggle button click
  it("toggles collapsed state when toggle button is clicked", async () => {
    render(<MiniSidebar items={testItems} />);

    const toggleButton = screen.getByLabelText("Collapse sidebar");
    const sidebar = screen.getByRole("navigation");

    // Initially expanded
    expect(sidebar).toHaveClass("w-[240px]");
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Click to collapse
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(sidebar).toHaveClass("w-[72px]");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("sidebar-collapsed", "true");
    });

    // Click to expand back
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(sidebar).toHaveClass("w-[240px]");
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith("sidebar-collapsed", "false");
    });
  });

  // 4. Tooltip on hover when collapsed
  it("shows tooltip on hover when collapsed", async () => {
    mockLocalStorage.getItem.mockReturnValue("true");
    render(<MiniSidebar items={testItems} />);

    const dashboardLink = screen.getByLabelText("Dashboard");
    fireEvent.mouseEnter(dashboardLink);

    // The tooltip should be present in the DOM
    await waitFor(() => {
      const tooltip = screen.getByText("Dashboard");
      expect(tooltip).toBeInTheDocument();
    });
  });

  // 5. Labels hidden when collapsed
  it("hides labels when collapsed", () => {
    mockLocalStorage.getItem.mockReturnValue("true");
    render(<MiniSidebar items={testItems} />);

    const labels = screen.queryAllByText(/Dashboard|Users|Settings/);
    labels.forEach((label) => {
      expect(label).not.toBeVisible();
    });
  });

  // 6. Active state indicator
  it("shows active indicator for current route", () => {
    render(<MiniSidebar items={testItems} />);

    const activeLink = screen.getByLabelText("Dashboard");
    expect(activeLink).toHaveClass("bg-[var(--sidebar-active-bg)]");
  });

  // 7. Keyboard accessibility
  it("toggle button is keyboard focusable and operable", () => {
    render(<MiniSidebar items={testItems} />);

    const toggleButton = screen.getByLabelText("Collapse sidebar");
    toggleButton.focus();

    expect(toggleButton).toHaveFocus();
    expect(toggleButton).toHaveAttribute("aria-expanded");
  });

  // 8. SSR safety
  it("defaults to expanded when window is undefined (SSR)", () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    render(<MiniSidebar items={testItems} />);

    const sidebar = screen.getByRole("navigation");
    expect(sidebar).toHaveClass("w-[240px]");

    global.window = originalWindow;
  });

  // 9. onCollapseChange callback
  it("calls onCollapseChange when collapsed state changes", async () => {
    const onCollapseChange = jest.fn();
    render(<MiniSidebar items={testItems} onCollapseChange={onCollapseChange} />);

    const toggleButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(onCollapseChange).toHaveBeenCalledWith(true);
    });

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(onCollapseChange).toHaveBeenLastCalledWith(false);
    });
  });

  // 10. Sections with submenus render correctly
  it("renders expandable sections with submenus", () => {
    render(<MiniSidebar items={testItems} sections={testSections} />);

    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Sales Report")).toBeInTheDocument();
    expect(screen.getByText("Lead Report")).toBeInTheDocument();
  });

  // 11. Expandable sections can be toggled
  it("toggles expandable section on click", async () => {
    render(<MiniSidebar items={testItems} sections={testSections} />);

    const sectionButton = screen.getByText("Reports").closest("button")!;

    // Click to collapse section
    fireEvent.click(sectionButton);

    await waitFor(() => {
      expect(screen.queryByText("Sales Report")).not.toBeVisible();
    });

    // Click to expand section
    fireEvent.click(sectionButton);

    await waitFor(() => {
      expect(screen.getByText("Sales Report")).toBeVisible();
    });
  });
});
