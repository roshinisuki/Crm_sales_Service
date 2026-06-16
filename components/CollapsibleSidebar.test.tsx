import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CollapsibleSidebar from "./CollapsibleSidebar";

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("CollapsibleSidebar", () => {
  beforeEach(() => {
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it("renders in expanded state by default", () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    render(<CollapsibleSidebar />);
    
    const sidebar = screen.getByRole("navigation");
    expect(sidebar).toHaveClass("w-[240px]");
    expect(sidebar).not.toHaveClass("w-[72px]");
  });

  it("renders in collapsed state when localStorage has 'true'", () => {
    mockLocalStorage.getItem.mockReturnValue("true");
    render(<CollapsibleSidebar />);
    
    const sidebar = screen.getByRole("navigation");
    expect(sidebar).toHaveClass("w-[72px]");
    expect(sidebar).not.toHaveClass("w-[240px]");
  });

  it("toggles collapse state when toggle button is clicked", async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    render(<CollapsibleSidebar />);
    
    const toggleButton = screen.getByLabelText("Collapse sidebar");
    const sidebar = screen.getByRole("navigation");
    
    // Initial state: expanded
    expect(sidebar).toHaveClass("w-[240px]");
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    
    // Click to collapse
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(sidebar).toHaveClass("w-[72px]");
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith("sidebar-collapsed", "true");
    });
  });

  it("shows tooltip on hover when collapsed", async () => {
    mockLocalStorage.getItem.mockReturnValue("true");
    render(<CollapsibleSidebar />);
    
    const dashboardLink = screen.getByLabelText("Dashboard");
    fireEvent.mouseEnter(dashboardLink);
    
    await waitFor(() => {
      const tooltip = screen.getByText("Dashboard");
      expect(tooltip).toBeInTheDocument();
    });
  });

  it("hides labels when collapsed", () => {
    mockLocalStorage.getItem.mockReturnValue("true");
    render(<CollapsibleSidebar />);
    
    const labels = screen.queryAllByText(/Dashboard|Overview|Notifications/);
    labels.forEach(label => {
      expect(label).not.toBeVisible();
    });
  });

  it("shows active state indicator for current route", () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    render(<CollapsibleSidebar />);
    
    const activeLink = screen.getByRole("link", { name: /dashboard/i });
    expect(activeLink).toHaveClass("bg-[var(--sidebar-active-bg)]");
  });

  it("keyboard accessible: toggle button is focusable", () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    render(<CollapsibleSidebar />);
    
    const toggleButton = screen.getByLabelText("Collapse sidebar");
    toggleButton.focus();
    
    expect(toggleButton).toHaveFocus();
  });

  it("handles SSR by defaulting to expanded state", () => {
    // Simulate SSR environment
    const originalWindow = global.window;
    delete (global as any).window;
    
    render(<CollapsibleSidebar />);
    
    const sidebar = screen.getByRole("navigation");
    expect(sidebar).toHaveClass("w-[240px]");
    
    global.window = originalWindow;
  });
});
