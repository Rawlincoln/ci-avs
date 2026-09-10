import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useStore } from "@/lib/drawing/store";
import { cn } from "@/lib/utils";

export function NavButtons() {
  const screen = useStore((s) => s.screen);
  const showLibrary = useStore((s) => s.showLibrary);
  const showSchedule = useStore((s) => s.showSchedule);
  const canBack = showLibrary || showSchedule || screen === "studio";
  const atHome = screen === "hub" && !showLibrary && !showSchedule;
  const backHint = showLibrary ? "Close equipment" : showSchedule ? "Close schedule" : "Back to projects";

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip content={canBack ? backHint : "Already on Home"} side="bottom">
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back"
            disabled={!canBack}
            onClick={() => useStore.getState().goBack()}
          >
            <ArrowLeft className="size-4" />
          </Button>
        </span>
      </Tooltip>
      <Tooltip content="Home — all projects" side="bottom">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Home"
          aria-current={atHome ? "page" : undefined}
          className={cn(atHome && "bg-surface-2 text-fg")}
          onClick={() => useStore.getState().goHome()}
        >
          <Home className="size-4" />
          <span className="hidden sm:inline">Home</span>
        </Button>
      </Tooltip>
    </div>
  );
}
