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

const TOUR_STEPS: TourStep[] = [
  // Step 0 – Welcome (center overlay, no target)
  {
    target: 'body',
    title: '🎵 Welcome to Melodica',
    content: 'Let\'s take a quick tour of the studio. We\'ll walk you through note editing, AI generation, recording tools, and the sheet music view.',
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
    content: 'Ready to lay down some live tracks? Click "Open Piano" to switch to the professional recording view, where you can record audio using your MIDI keyboard.',
    page: '/studio',
    placement: 'bottom',
    disableBeacon: true,
    spotlightClicks: true,
  },
  // Step 5 – Record Audio
  {
    target: '[data-tour="piano-record-btn"]',
    title: '🎙️ Record Audio',
    content: 'Hit this button to arm recording and capture your live playing directly to the track. Try it out—click it to start, and click it again to stop!',
    page: '/piano',
    placement: 'bottom',
    disableBeacon: true,
    spotlightClicks: true,
  },
  // Step 6 – Metronome
  {
    target: '[data-tour="piano-metronome-btn"]',
    title: '⏱️ Metronome',
    content: 'Toggle the metronome click track here (speaker icon) to keep perfect time while recording.',
    page: '/piano',
    placement: 'bottom',
    disableBeacon: true,
  },
  // Step 7 – Count-In
  {
    target: '[data-tour="piano-count-in"]',
    title: '⏳ Count-In',
    content: 'Set a 1 or 2 bar count-in so you have time to get your hands ready before the actual recording kicks in.',
    page: '/piano',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 8 – Quantization
  {
    target: '[data-tour="piano-quantize"]',
    title: '🧲 Quantization',
    content: 'Enable quantization to automatically snap your recorded notes to the grid (e.g. 1/8 or 1/16 notes) so your playing is perfectly tight.',
    page: '/piano',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 9 – Velocity Bar
  {
    target: '[data-tour="piano-velocity"]',
    title: '🏃 Velocity Bar',
    content: 'Monitor the strength and intensity of your live key presses right here in real-time.',
    page: '/piano',
    placement: 'right',
    disableBeacon: true,
  },
  // Step 10 – Multi-Staff Chords
  {
    target: '[data-tour="sheet-music-stage"]',
    title: '🎼 Multi-Staff Chords',
    content: 'You can build complex chords and harmonies by recording multiple passes. The system will layer them on overlapping staves right here on the sheet music stage.',
    page: '/piano',
    placement: 'top',
    disableBeacon: true,
  },
  // Step 11 – View Sheet Music (back to Studio)
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
  const router   = useRouter();
  const pathname = usePathname();

  const [run, setRun]             = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted]     = useState(false);
  const [dbComplete, setDbComplete] = useState<boolean | null>(null);
  const navigatingRef             = useRef(false);
  const pollTimerRef              = useRef<NodeJS.Timeout | null>(null);
  const supabase                  = createClient();

  // -- Mount check & Auth check --
  useEffect(() => { 
    setMounted(true); 
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.has_completed_tour) {
        setDbComplete(true);
      } else {
        setDbComplete(false);
      }
    })();
  }, [supabase]);

  // -- Auto-trigger on Studio page if tour not completed --
  useEffect(() => {
    if (!mounted || dbComplete === null) return;
    
    // Check LocalStorage first for speed, then DB
    const localCompleted = localStorage.getItem(STORAGE_KEY_COMPLETE);
    if (localCompleted || dbComplete) return;

    // Check if we're resuming a tour in progress (cross-page nav)
    const savedStep = localStorage.getItem(STORAGE_KEY_STEP);
    const isRunning = localStorage.getItem(STORAGE_KEY_RUNNING);

    if (isRunning === 'true' && savedStep) {
      let stepIdx = parseInt(savedStep, 10);

      // Handle spotlightClicks auto-advancing based on URL changes
      if (stepIdx === 4 && pathname.startsWith('/piano')) {
        // User clicked "Open Piano" from step 4
        stepIdx = 5;
        localStorage.setItem(STORAGE_KEY_STEP, '5');
      } else if (stepIdx === TOUR_STEPS.length - 1 && pathname.startsWith('/sheet-music')) {
        // User clicked "View Sheet Music" on the last step, successfully finishing the tour
        setRun(false);
        localStorage.setItem(STORAGE_KEY_COMPLETE, 'true');
        localStorage.removeItem(STORAGE_KEY_STEP);
        localStorage.removeItem(STORAGE_KEY_RUNNING);
        
        // Persist to account
        supabase.auth.updateUser({ data: { has_completed_tour: true } });
        
        // Hard navigate so the studio cleanly mounts the Happy Birthday sample
        window.location.assign('/studio?id=55d72c9d-f2d3-410c-8deb-57588f275679&midi=%2FHappy_Sample.mid');
        return;
      }

      const targetPage = TOUR_STEPS[stepIdx]?.page;
      if (pathname === targetPage || pathname.startsWith(targetPage)) {
        setStepIndex(stepIdx);
        waitForTarget(TOUR_STEPS[stepIdx].target, () => {
          setRun(true);
          navigatingRef.current = false;
        });
      }
    } else if (pathname === '/studio' || pathname.startsWith('/studio')) {
      // First-time auto trigger on Studio page
      setStepIndex(0);
      setRun(true);
      localStorage.setItem(STORAGE_KEY_RUNNING, 'true');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pathname]);

  // -- Cleanup poll timer on unmount --
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // -- Wait for a DOM element to appear --
  const waitForTarget = useCallback((selector: string, onFound: () => void) => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    let attempts = 0;
    const maxAttempts = 40; // ~4 seconds max

    const poll = () => {
      attempts++;
      const el = document.querySelector(selector);
      if (el) {
        onFound();
        return;
      }
      if (attempts < maxAttempts) {
        pollTimerRef.current = setTimeout(poll, 100);
      }
    };
    // Small initial delay for page transition
    pollTimerRef.current = setTimeout(poll, 200);
  }, []);

  // -- Navigate to the step's page if needed --
  const navigateToStep = useCallback((idx: number) => {
    const step = TOUR_STEPS[idx];
    if (!step) return;

    const targetPage = step.page;
    const onTargetPage = pathname === targetPage || pathname.startsWith(targetPage + '?');

    // Persist step for cross-page resume
    localStorage.setItem(STORAGE_KEY_STEP, String(idx));

    if (!onTargetPage) {
      // Need to navigate — pause tour, navigate, wait for element
      navigatingRef.current = true;
      setRun(false);
      router.push(targetPage);
      // The useEffect on pathname change will resume the tour
    } else {
      // Same page — wait for target element then show step
      waitForTarget(step.target, () => {
        setStepIndex(idx);
        setRun(true);
        navigatingRef.current = false;
      });
    }
  }, [pathname, router, waitForTarget]);

  // -- Joyride callback handler --
  const handleJoyrideCallback = useCallback((data: any) => {
    const { action, index, type, status, lifecycle } = data;

    // Tour finished, skipped, or manually closed
    // We also check for 'next' action on the last step as that's when "Finish" is clicked
    const isLastStep = index === TOUR_STEPS.length - 1;
    const isFinished = status === 'finished' || (isLastStep && type === 'step:after' && action === 'next');

    if (isFinished || status === 'skipped' || action === 'close') {
      setRun(false);
      localStorage.setItem(STORAGE_KEY_COMPLETE, 'true');
      localStorage.removeItem(STORAGE_KEY_STEP);
      localStorage.removeItem(STORAGE_KEY_RUNNING);

      // Persist to account
      supabase.auth.updateUser({ data: { has_completed_tour: true } });

      // Definitively redirect to the demo project with a hard reload
      setTimeout(() => {
        window.location.assign('/studio?id=55d72c9d-f2d3-410c-8deb-57588f275679&midi=%2FHappy_Sample.mid');
      }, 100);
      return;
    }

    if (type === 'step:after') {
      if (action === 'next') {
        const nextIdx = index + 1;
        if (nextIdx < TOUR_STEPS.length) {
          navigateToStep(nextIdx);
        }
      } else if (action === 'prev') {
        const prevIdx = index - 1;
        if (prevIdx >= 0) {
          navigateToStep(prevIdx);
        }
      }
    }

  }, [navigateToStep]);

  // -- Manual start (called from Help button) --
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(STORAGE_KEY_COMPLETE);
      localStorage.setItem(STORAGE_KEY_RUNNING, 'true');

      // If not on studio, navigate there first
      if (pathname !== '/studio' && !pathname.startsWith('/studio')) {
        localStorage.setItem(STORAGE_KEY_STEP, '0');
        router.push('/studio');
      } else {
        setStepIndex(0);
        setRun(true);
      }
    };

    window.addEventListener('melodica:start-tour', handler);
    return () => window.removeEventListener('melodica:start-tour', handler);
  }, [pathname, router]);

  if (!mounted) return null;

  // Convert steps to react-joyride format
  const joyrideSteps = TOUR_STEPS.map((s) => ({
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
