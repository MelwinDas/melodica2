'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Joyride } from 'react-joyride';
import { createClient } from '../../lib/supabase';



/* --- Tour Step Definitions --- */

interface TourStep {
  target: string;
  title: string;
  content: string;
  page: string;          // which route this step lives on
  disableBeacon?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto';
  spotlightClicks?: boolean;
}

const STUDIO_TOUR_STEPS: TourStep[] = [
  // Step 0 – Welcome (center overlay, no target)
  {
    target: 'body',
    title: '🎵 Welcome to Melodica',
    content: 'Let\'s take a quick tour of the studio. We\'ll walk you through note editing, AI generation, and exporting your tracks.',
    page: '/studio',
    placement: 'center',
    disableBeacon: true,
  },
  // Step 1 – Editing Notes
  {
    target: '[data-tour="piano-roll-tools"]',
    title: '✏️ Editing Notes',
    content: "Double-click the grid to add a note block. Use the 'Select' tool to highlight and move multiple blocks, or use the 'Erase' tool to delete them.",
    page: '/studio',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 2 – AI Generation
  {
    target: '[data-tour="ai-generate-panel"]',
    title: '🤖 AI Music Engine',
    content: "Choose a genre and adjust the temperature (creativity) slider. Click 'Generate' to let the AI continue your current sequence.",
    page: '/studio',
    placement: 'left',
    disableBeacon: true,
  },
  // Step 3 – Export Your Work
  {
    target: '[data-tour="export-tab-btn"]',
    title: '📦 Export Your Work',
    content: 'Export your session as MIDI for editing in DAWs, or render to high-quality audio directly from the browser.',
    page: '/studio',
    placement: 'left',
    disableBeacon: true,
  },
  // Step 4 – Open Piano
  {
    target: '[data-tour="open-piano-btn"]',
    title: '🎹 Live Recording',
    content: 'Ready to lay down some live tracks? Click "Open Piano" anytime to switch to the professional recording view. (You can take a separate tour there!)',
    page: '/studio',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 5 – View Sheet Music
  {
    target: '[data-tour="view-sheet-music-btn"]',
    title: '🎶 View Sheet Music',
    content: 'Take a look at your generated masterpiece! Click this button to open the full Sheet Music View and finalize your track.',
    page: '/studio',
    placement: 'bottom',
    disableBeacon: true,
    spotlightClicks: true,
  },
];

const PIANO_TOUR_STEPS: TourStep[] = [
  // Step 0 – Welcome
  {
    target: 'body',
    title: '🎹 Piano Recording',
    content: "Welcome to the recording view! Let's explore the tools you'll use to capture your live performance, from metronomes to quantization.",
    page: '/piano',
    placement: 'center',
    disableBeacon: true,
  },
  // Step 1 – Record Audio
  {
    target: '[data-tour="piano-record-btn"]',
    title: '🎙️ Record Audio',
    content: 'Hit this button to arm recording and capture your live playing directly to the track. Try it out—click it to start, and click it again to stop!',
    page: '/piano',
    placement: 'bottom',
    disableBeacon: true,
    spotlightClicks: true,
  },
  // Step 1 – Metronome
  {
    target: '[data-tour="piano-metronome-btn"]',
    title: '⏱️ Metronome',
    content: 'Toggle the metronome click track here (speaker icon) to keep perfect time while recording.',
    page: '/piano',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 2 – Count-In
  {
    target: '[data-tour="piano-count-in"]',
    title: '⏳ Count-In',
    content: 'Set a 1 or 2 bar count-in so you have time to get your hands ready before the actual recording kicks in.',
    page: '/piano',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 3 – Quantization
  {
    target: '[data-tour="piano-quantize"]',
    title: '🧲 Quantization',
    content: 'Enable quantization to automatically snap your recorded notes to the grid (e.g. 1/8 or 1/16 notes) so your playing is perfectly tight.',
    page: '/piano',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 4 – Velocity Bar
  {
    target: '[data-tour="piano-velocity"]',
    title: '🏃 Velocity Bar',
    content: 'Monitor the strength and intensity of your live key presses right here in real-time.',
    page: '/piano',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 5 – Multi-Staff Chords
  {
    target: '[data-tour="sheet-music-stage"]',
    title: '🎼 Multi-Staff Chords',
    content: 'You can build complex chords and harmonies by recording multiple passes. The system will layer them on overlapping staves right here on the sheet music stage.',
    page: '/piano',
    placement: 'top',
    disableBeacon: true,
  },
];

const STORAGE_KEY_COMPLETE = 'melodica_tour_complete';
const STORAGE_KEY_STEP     = 'melodica_tour_step';
const STORAGE_KEY_RUNNING  = 'melodica_tour_running';

/* --- Custom Tooltip --- */

function TourTooltip({
  continuous, index, step, size,
  backProps, closeProps, primaryProps, skipProps, tooltipProps,
  isLastStep,
}: any) {
  const progress = ((index + 1) / size) * 100;

  return (
    <div
      {...tooltipProps}
      style={{
        background: 'linear-gradient(145deg, #1e1b2e 0%, #16132a 100%)',
        borderRadius: 16,
        padding: 0,
        maxWidth: 380,
        border: '1px solid rgba(139,92,246,0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(139,92,246,0.15)',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(139,92,246,0.15)' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #8b5cf6 0%, #14b8a6 100%)',
          transition: 'width 0.4s ease',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Title */}
        {step.title && (
          <h3 style={{
            margin: '0 0 8px',
            fontSize: 16,
            fontWeight: 700,
            color: '#f0eeff',
            lineHeight: 1.3,
          }}>
            {step.title}
          </h3>
        )}

        {/* Body */}
        <p style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.65,
          color: '#a5a0c0',
        }}>
          {step.content}
        </p>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px 16px',
        borderTop: '1px solid rgba(139,92,246,0.12)',
      }}>
        {/* Step counter */}
        <span style={{ fontSize: 11, color: '#6b6890', fontWeight: 600 }}>
          {index + 1} / {size}
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Skip */}
          {!isLastStep && (
            <button
              {...skipProps}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b6890',
                fontSize: 12,
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: 8,
                fontWeight: 600,
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = '#a5a0c0')}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = '#6b6890')}
            >
              Skip Tour
            </button>
          )}

          {/* Back */}
          {index > 0 && (
            <button
              {...backProps}
              style={{
                background: 'rgba(139,92,246,0.1)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: '#c4b5fd',
                fontSize: 12,
                cursor: 'pointer',
                padding: '6px 14px',
                borderRadius: 8,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              Back
            </button>
          )}

          {/* Next / Finish */}
          <button
            {...primaryProps}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              border: 'none',
              color: 'white',
              fontSize: 12,
              cursor: 'pointer',
              padding: '6px 18px',
              borderRadius: 8,
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
              transition: 'all 0.15s',
            }}
          >
            {isLastStep ? '🎉 Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Main Tour Component --- */

export default function OnboardingTour() {
  const pathname = usePathname();

  const [run, setRun]             = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted]     = useState(false);
  const [dbComplete, setDbComplete] = useState<boolean | null>(null);
  const [tourSteps, setTourSteps] = useState<TourStep[]>(STUDIO_TOUR_STEPS);
  const pollTimerRef              = useRef<NodeJS.Timeout | null>(null);
  const supabase                  = createClient();

  // -- Mount check & Auth check --
  useEffect(() => { 
    setMounted(true); 
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setDbComplete(!!user?.user_metadata?.has_completed_tour);
    })();
  }, [supabase]);

  // -- Auto-trigger Studio Tour --
  useEffect(() => {
    if (!mounted || dbComplete === null) return;
    
    // DB is the source of truth. If DB says complete, we stop.
    // If DB says incomplete, we ignore LocalStorage (which might have a flag from another user).
    if (dbComplete === true) return;

    // Only auto-trigger on Studio
    if (pathname === '/studio' || pathname.startsWith('/studio')) {
      const isRunning = localStorage.getItem(STORAGE_KEY_RUNNING);
      if (isRunning !== 'true') {
        localStorage.setItem(STORAGE_KEY_RUNNING, 'true');
        localStorage.setItem(STORAGE_KEY_STEP, '0');
        setTourSteps(STUDIO_TOUR_STEPS);
        setStepIndex(0);
        setRun(true);
      } else {
        // Resume Studio tour if it was interrupted on the same page
        const savedStep = localStorage.getItem(STORAGE_KEY_STEP);
        if (savedStep) {
          setTourSteps(STUDIO_TOUR_STEPS);
          setStepIndex(parseInt(savedStep, 10));
          setRun(true);
        }
      }
    }
  }, [mounted, pathname, dbComplete]);

  // -- Cleanup poll timer on unmount --
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // -- Joyride callback handler --
  const handleJoyrideCallback = useCallback((data: any) => {
    const { action, index, type, status } = data;

    const isLastStep = index === tourSteps.length - 1;
    const isFinished = status === 'finished' || status === 'skipped' || action === 'close' || (isLastStep && type === 'step:after' && action === 'next');

    if (isFinished) {
      setRun(false);
      
      const wasStudioTour = tourSteps === STUDIO_TOUR_STEPS;
      
      // Mark as globally complete if Studio tour is finished or skipped
      if (wasStudioTour) {
        localStorage.setItem(STORAGE_KEY_COMPLETE, 'true');
        supabase.auth.updateUser({ data: { has_completed_tour: true } });
      }

      localStorage.removeItem(STORAGE_KEY_STEP);
      localStorage.removeItem(STORAGE_KEY_RUNNING);
      return;
    }

    if (type === 'step:after') {
      const nextIdx = index + (action === 'prev' ? -1 : 1);
      if (nextIdx >= 0 && nextIdx < tourSteps.length) {
        setStepIndex(nextIdx);
        localStorage.setItem(STORAGE_KEY_STEP, String(nextIdx));
      }
    }
  }, [tourSteps, supabase]);

  // -- Manual Tour Trigger Listeners --
  useEffect(() => {
    const startStudio = () => {
      localStorage.removeItem(STORAGE_KEY_COMPLETE);
      localStorage.setItem(STORAGE_KEY_RUNNING, 'true');
      localStorage.setItem(STORAGE_KEY_STEP, '0');
      setTourSteps(STUDIO_TOUR_STEPS);
      setStepIndex(0);
      setRun(true);
    };

    const startPiano = () => {
      localStorage.setItem(STORAGE_KEY_STEP, '0');
      setTourSteps(PIANO_TOUR_STEPS);
      setStepIndex(0);
      setRun(true);
    };

    window.addEventListener('melodica:start-tour', startStudio);
    window.addEventListener('melodica:start-piano-tour', startPiano);
    return () => {
      window.removeEventListener('melodica:start-tour', startStudio);
      window.removeEventListener('melodica:start-piano-tour', startPiano);
    };
  }, []);

  if (!mounted) return null;

  // Convert steps to react-joyride format
  const joyrideSteps = tourSteps.map((s) => ({
    target: s.target,
    title: s.title,
    content: s.content,
    disableBeacon: s.disableBeacon ?? true,
    placement: s.placement ?? ('auto' as const),
    spotlightClicks: s.spotlightClicks ?? false,
  }));

  return (
    <Joyride
      steps={joyrideSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideCallback}
      tooltipComponent={TourTooltip}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip Tour',
      }}
      options={{
        zIndex: 10000,
        arrowColor: '#1e1b2e',
        overlayColor: 'rgba(10, 8, 20, 0.7)',
        overlayClickAction: false,
        dismissKeyAction: 'close',
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      floatingOptions={{
        onPosition: undefined,
      }}
    />
  );
}
