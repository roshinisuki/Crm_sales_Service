"use client";

/** orange=ember  blue=ocean  green=forest  purple=obsidian  dark=dark-mode  neutral=obsidian-light */
export type LogoTheme = "orange" | "blue" | "green" | "purple" | "dark" | "neutral";
export type LogoVariant = "full" | "mark-only";

interface LogoProps {
  theme: LogoTheme;
  variant?: LogoVariant;
  /** Height in px. Width is derived from the SVG aspect ratio. */
  size?: number;
  className?: string;
}

const ACCENT: Record<LogoTheme, string> = {
  orange:  "var(--brand-primary, #FF6901)",  // orange gradient
  blue:    "var(--brand-primary, #2090FF)",  // blue gradient
  green:   "var(--brand-primary, #7f9e15)",  // forest green gradient
  purple:  "var(--brand-primary, #CD69ED)",  // deep purple gradient
  dark:    "#FFFFFF",  // login page explicit all-white
  neutral: "#FFFFFF",  // obsidian-light fallback to white on dark sidebar
};

// Glow colors per theme (used by GlowFilter)
const GLOW_HEX: Record<LogoTheme, string> = {
  orange:  "#FF6901",
  blue:    "#2090FF",
  green:   "#7f9e15",
  purple:  "#CD69ED",
  dark:    "#FFFFFF",
  neutral: "#FFFFFF",
};

// ─── Shared path data (from public/crm orange.svg) ────────────────────────────

/** Upper swirl — white half of the icon mark. ViewBox region x:0-620. */
const MARK_TOP = "M271.347 173.512C237.169 206.503 215.384 228.149 203.656 242.342C194.179 253.81 188.645 269.227 191.464 283.834C191.711 285.112 192.016 286.384 192.377 287.657C198.551 309.419 219.934 328.342 242.543 329.111C256.771 329.595 267.822 321.485 279.008 312.679L292.896 301.747C318.658 285.273 332.019 283.919 346.94 290.838C358.553 296.222 369.832 304.584 373.488 316.852C379.301 336.36 367.864 359.412 357.5 385L550.394 187.336C571.167 166.05 589.903 140.83 592.595 111.211C594.207 93.4827 591.102 77.3818 581.513 58.8554C572.531 41.4987 558.339 27.2564 541.628 17.1232C510.479 -1.76393 485.973 -4.50561 454.775 6.33468C434.99 13.2098 418.298 26.5609 403.486 41.3722L271.347 173.512Z";

/** Lower swirl — accent half of the icon mark. ViewBox region x:0-620. */
const MARK_BOT = "M189.087 118.13L258.698 185.875L222.04 222.655C209.22 235.518 195.788 249.404 192.312 267.229C190.473 276.658 191.684 285.833 196.833 296.724C203.633 311.107 215.578 322.259 231.016 326.105C248.103 330.363 266.076 321.417 280.218 310.924L296.061 299.17C320.042 283.692 334.026 279.663 362.043 299.17C374.977 309.303 381.225 318.813 381.49 332.19C382.016 358.781 362.384 380.904 343.578 399.71C325.757 417.531 305.095 433.974 280.244 438.171C270.085 439.887 259.538 440.088 247.099 438.321C217.168 434.071 191.615 415.603 170.238 394.227L48.3503 272.339C24.5145 248.503 4.61911 219.395 0.842184 185.898C-2.03178 160.409 2.24751 140.728 16.8081 119.724C22.7924 111.091 30.4126 103.676 38.7958 97.3471C63.0675 79.024 84.1537 71.4863 115.357 76.2054C143.924 80.526 168.381 97.9789 189.087 118.13Z";

/** SUKI text wordmark (S, U, K, I paths) — top text area y:43-151. */
const WORDMARK = "M686.05 151.5C678.45 151.6 671.85 150.4 666.25 147.9C660.65 145.4 655.3 141.65 650.2 136.65C649.7 136.25 649.25 135.75 648.85 135.15C648.55 134.55 648.4 133.85 648.4 133.05C648.4 131.85 648.85 130.75 649.75 129.75C650.75 128.75 651.85 128.25 653.05 128.25C654.25 128.25 655.35 128.75 656.35 129.75C660.25 133.95 664.65 137.15 669.55 139.35C674.55 141.55 679.9 142.65 685.6 142.65C690.4 142.65 694.65 141.9 698.35 140.4C702.15 138.9 705.15 136.75 707.35 133.95C709.55 131.15 710.65 127.9 710.65 124.2C710.65 119.6 709.4 115.9 706.9 113.1C704.4 110.2 701.1 107.85 697 106.05C692.9 104.15 688.35 102.45 683.35 100.95C679.25 99.75 675.35 98.4 671.65 96.9C667.95 95.3 664.65 93.4 661.75 91.2C658.85 88.9 656.6 86.1 655 82.8C653.4 79.5 652.6 75.5 652.6 70.8C652.6 65.5 654 60.8 656.8 56.7C659.6 52.6 663.55 49.4 668.65 47.1C673.85 44.7 679.85 43.5 686.65 43.5C692.55 43.5 698.2 44.5 703.6 46.5C709.1 48.5 713.45 51.45 716.65 55.35C718.15 56.95 718.9 58.4 718.9 59.7C718.9 60.7 718.4 61.7 717.4 62.7C716.4 63.7 715.3 64.2 714.1 64.2C713.1 64.2 712.25 63.85 711.55 63.15C709.85 61.05 707.7 59.2 705.1 57.6C702.5 55.9 699.6 54.6 696.4 53.7C693.3 52.8 690.05 52.35 686.65 52.35C681.95 52.35 677.7 53.1 673.9 54.6C670.2 56 667.25 58.05 665.05 60.75C662.95 63.45 661.9 66.7 661.9 70.5C661.9 74.7 663.1 78.15 665.5 80.85C667.9 83.55 671.05 85.8 674.95 87.6C678.85 89.3 683 90.9 687.4 92.4C691.7 93.6 695.8 95 699.7 96.6C703.7 98.1 707.2 100 710.2 102.3C713.3 104.6 715.7 107.5 717.4 111C719.2 114.5 720.1 118.9 720.1 124.2C720.1 129.3 718.65 133.9 715.75 138C712.85 142.1 708.85 145.35 703.75 147.75C698.75 150.15 692.85 151.4 686.05 151.5ZM830.579 45C831.979 45 833.079 45.45 833.879 46.35C834.679 47.15 835.079 48.2 835.079 49.5V111.6C835.079 119 833.329 125.7 829.829 131.7C826.329 137.7 821.629 142.5 815.729 146.1C809.829 149.6 803.179 151.35 795.779 151.35C788.379 151.35 781.679 149.6 775.679 146.1C769.779 142.5 765.079 137.7 761.579 131.7C758.079 125.7 756.329 119 756.329 111.6V49.5C756.329 48.2 756.729 47.15 757.529 46.35C758.429 45.45 759.629 45 761.129 45C762.329 45 763.379 45.45 764.279 46.35C765.179 47.15 765.629 48.2 765.629 49.5V111.6C765.629 117.4 766.979 122.6 769.679 127.2C772.479 131.8 776.179 135.5 780.779 138.3C785.379 141 790.379 142.35 795.779 142.35C801.379 142.35 806.479 141 811.079 138.3C815.679 135.5 819.329 131.8 822.029 127.2C824.829 122.6 826.229 117.4 826.229 111.6V49.5C826.229 48.2 826.629 47.15 827.429 46.35C828.229 45.45 829.279 45 830.579 45ZM953.262 150.6C951.962 150.6 950.862 150.05 949.962 148.95L907.362 95.4L914.412 88.35L957.312 142.65C958.012 143.65 958.362 144.7 958.362 145.8C958.362 147.4 957.762 148.6 956.562 149.4C955.462 150.2 954.362 150.6 953.262 150.6ZM951.612 45.3C952.812 45.3 953.812 45.75 954.612 46.65C955.512 47.55 955.962 48.55 955.962 49.65C955.962 50.85 955.512 51.9 954.612 52.8L886.512 116.55L885.312 106.35L948.312 46.8C949.312 45.8 950.412 45.3 951.612 45.3ZM882.912 150C881.512 150 880.362 149.55 879.462 148.65C878.662 147.75 878.262 146.65 878.262 145.35V49.65C878.262 48.35 878.712 47.25 879.612 46.35C880.512 45.45 881.662 45 883.062 45C884.362 45 885.462 45.45 886.362 46.35C887.262 47.25 887.712 48.35 887.712 49.65V145.35C887.612 146.65 887.112 147.75 886.212 148.65C885.312 149.55 884.212 150 882.912 150ZM1003.93 145.35C1003.83 146.65 1003.28 147.75 1002.28 148.65C1001.38 149.55 1000.33 150 999.133 150C997.733 150 996.583 149.55 995.683 148.65C994.883 147.75 994.483 146.65 994.483 145.35V49.65C994.483 48.35 994.933 47.25 995.833 46.35C996.733 45.45 997.883 45 999.283 45C1000.48 45 1001.53 45.45 1002.43 46.35C1003.43 47.25 1003.93 48.35 1003.93 49.65V145.35Z";

// ──────────────────────────────────────────────────────────────────────────────

/**
 * Theme-aware SUKI CRM logo.
 *
 * variant="full"      → full 1286×440 SVG lockup: icon mark + SUKI letterforms.
 *                       Replaces both the icon image AND the HTML brand name.
 * variant="mark-only" → just the abstract swirl icon, viewBox cropped to 620×440.
 *
 * Accent colors per theme:
 *   orange  (#F77F00)  ember theme, light mode
 *   blue    (#8ECAE6)  ocean theme, light mode
 *   green   (#65B017)  forest theme, light mode
 *   purple  (#4a0875)  obsidian theme, light mode
 *   dark    (#FFFFFF)  any dark mode / login page
 *   neutral (#FFFFFF)  obsidian theme fallback
 *
 * Paths are extracted verbatim from public/crm orange.svg (official brand file).
 */

/** SVG glow filter component — adds a soft glow behind accent paths */
function GlowFilter({ id, color }: { id: string; color: string }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feFlood floodColor={color} floodOpacity="0.5" result="color" />
      <feComposite in="color" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

export default function Logo({
  theme,
  variant = "full",
  size = 32,
  className,
}: LogoProps) {
  // Map themes to external gradient SVG files
  // ?v=2 cache-busts old logo files so browsers load the updated gradients
  const logoMap: Record<LogoTheme, string> = {
    blue: "/logo-darkblue.svg?v=2",
    purple: "/logo-purple.svg?v=2",
    green: "/logo-green.svg?v=2",
    orange: "/logo-orange.svg?v=2", // Orange theme uses orange gradient
    dark: "/crm black (3).svg?v=2", // Keep existing white-on-black for dark mode
    neutral: "/crm black (3).svg?v=2", // Keep existing white-on-black for neutral
  };

  const logoSrc = logoMap[theme];

  // Black/dark/neutral themes use the uploaded white-on-black SVG file
  if (theme === "dark" || theme === "neutral") {
    if (variant === "mark-only") {
      return (
        <div suppressHydrationWarning>
          <svg
            width={Math.round(size * (620 / 445))}
            height={size}
            viewBox="0 0 620 445"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-label="SUKI CRM"
          >
            <image href="/crm black (3).svg" width="1282" height="445" />
          </svg>
        </div>
      );
    }

    return (
      <div suppressHydrationWarning>
        <img
          src="/crm black (3).svg"
          alt="SUKI CRM"
          width={Math.round(size * (1282 / 445))}
          height={size}
          className={className}
        />
      </div>
    );
  }

  if (variant === "mark-only") {
    return (
      <div suppressHydrationWarning>
        <img
          src={logoSrc}
          alt="SUKI CRM"
          width={Math.round(size * (620 / 445))}
          height={size}
          className={className}
        />
      </div>
    );
  }

  // variant === "full" — complete brand lockup
  return (
    <div suppressHydrationWarning>
      <img
        src={logoSrc}
        alt="SUKI CRM"
        width={Math.round(size * (1286 / 440))}
        height={size}
        className={className}
      />
    </div>
  );
}
