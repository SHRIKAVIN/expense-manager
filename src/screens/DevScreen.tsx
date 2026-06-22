import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField, TextArea } from "@/components/TextField";
import { Chip } from "@/components/Chip";
import { SegmentedControl } from "@/components/SegmentedControl";
import { ProgressBar } from "@/components/ProgressBar";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet } from "@/components/Sheet";
import { Lightbox } from "@/components/Lightbox";
import { CountUp } from "@/components/CountUp";
import { RoleBadge } from "@/components/RoleBadge";
import { useToast } from "@/components/Toast";
import { CameraIcon, FoodIcon, ListIcon, SearchIcon } from "@/lib/icons";

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <p className="text-tagline text-ink mb-4">{title}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </Card>
  );
}

/** Storybook-style visual check of the component library against the tokens. */
export function DevScreen() {
  const { show } = useToast();
  const [chip, setChip] = useState("food");
  const [seg, setSeg] = useState("month");
  const [progress, setProgress] = useState(0.4);
  const [sheet, setSheet] = useState(false);
  const [light, setLight] = useState(false);
  const [count, setCount] = useState(1240.5);

  return (
    <div className="h-full overflow-y-auto mx-auto w-full max-w-2xl px-5 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display-md text-ink">Components</h1>
        <Link to="/" className="text-body text-primary">
          ← App
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        <Row title="Typography ladder">
          <div className="flex flex-col gap-2 w-full">
            <span className="text-display-lg text-ink">Display LG</span>
            <span className="text-display-md text-ink">Display MD</span>
            <span className="text-lead text-ink">Lead</span>
            <span className="text-tagline text-ink">Tagline</span>
            <span className="text-body-strong text-ink">Body strong</span>
            <span className="text-body text-ink">Body 17/1.47</span>
            <span className="text-caption text-ink-muted-48">Caption</span>
            <span className="text-fine-print text-ink-muted-48">Fine print</span>
          </div>
        </Row>

        <Row title="Buttons">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="icon-circular" aria-label="Camera">
            <CameraIcon size={20} />
          </Button>
        </Row>

        <Row title="Inputs">
          <div className="w-full flex flex-col gap-4">
            <TextField shape="pill" placeholder="Search" leftAdornment={<SearchIcon size={18} />} />
            <TextField label="Standard field" placeholder="Type…" />
            <TextField label="With error" placeholder="0.00" error="Amount must be greater than 0" />
            <TextArea label="Notes" rows={2} placeholder="Multi-line" />
          </div>
        </Row>

        <Row title="Chips">
          {["food", "transport", "shopping"].map((c) => (
            <Chip
              key={c}
              selected={chip === c}
              onClick={() => setChip(c)}
              leftIcon={<FoodIcon size={16} />}
            >
              {c}
            </Chip>
          ))}
        </Row>

        <Row title="Segmented control">
          <SegmentedControl
            ariaLabel="demo"
            value={seg}
            onChange={setSeg}
            segments={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
              { value: "year", label: "Year" },
            ]}
          />
        </Row>

        <Row title="Progress bar">
          <div className="w-full flex flex-col gap-3">
            <ProgressBar value={progress} />
            <ProgressBar value={1.3} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setProgress(Math.random())}>
                Randomize
              </Button>
            </div>
          </div>
        </Row>

        <Row title="Count-up">
          <CountUp value={count} currency="INR" className="text-display-lg text-ink" />
          <Button variant="secondary" onClick={() => setCount(Math.round(Math.random() * 5000))}>
            Change
          </Button>
        </Row>

        <Row title="Theme toggle">
          <ThemeToggle />
        </Row>

        <Row title="Role badge">
          <RoleBadge role="Owner" />
          <RoleBadge role="Member" />
          <RoleBadge role="Viewer" />
        </Row>

        <Row title="Overlays & feedback">
          <Button variant="primary" onClick={() => setSheet(true)}>
            Open sheet
          </Button>
          <Button variant="secondary" onClick={() => setLight(true)}>
            Open lightbox
          </Button>
          <Button variant="secondary" onClick={() => show("Toast message")}>
            Show toast
          </Button>
        </Row>

        <Card>
          <EmptyState
            icon={<ListIcon size={48} />}
            headline="Empty state"
            subcopy="Centered icon, lead headline, body subcopy and a primary action."
            actionLabel="Primary action"
            onAction={() => show("Action!")}
          />
        </Card>
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Demo sheet">
        <p className="text-body text-ink">
          Bottom sheet on mobile, centered modal on desktop. Spring entry, scrim fade.
        </p>
      </Sheet>
      <Lightbox
        src={
          light
            ? "data:image/svg+xml;utf8," +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="400" height="560" fill="#f5f5f7"/><text x="200" y="280" text-anchor="middle" fill="#7a7a7a" font-size="20">Receipt</text></svg>',
              )
            : null
        }
        onClose={() => setLight(false)}
      />
    </div>
  );
}
