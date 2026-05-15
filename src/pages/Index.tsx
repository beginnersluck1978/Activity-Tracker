import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { Activity } from "@/types/activity";
import { Mic, MicOff, ExternalLink, Square, Loader2, Keyboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import bgSki from "@/assets/bg-ski.jpg";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1M75bxtHgB5HWZZ4nyRjwzciN4BI2kSeq-flJZk3TlfM/edit?gid=0#gid=0";
const API_URL = "https://script.google.com/macros/s/AKfycbxOZ1XQTApK6ha3EkTtaAHPV6jbcZZPbuIj80kIPM-hoaJ_I3zzWuhXcH5dOOV9dDGR/exec";
const USER_ID = "james";
const TIMEZONE = "America/Winnipeg";

const getWinnipegTimeString = (): string =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

const getWinnipegDateString = (): string =>
  new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE }).format(new Date());

const isApiConfigured = () => !API_URL.includes("PASTE_MY_GOOGLE_APPS_SCRIPT");

async function apiPost(payload: Record<string, unknown>) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from API");
  }
}

const Index = () => {
  const { toast } = useToast();
  const {
    isListening, transcript, startListening, stopListening, resetTranscript, isSupported,
  } = useSpeechRecognition();

  const [editableTranscript, setEditableTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const guardApi = useCallback(() => {
    if (!isApiConfigured()) {
      toast({ title: "Configuration needed", description: "Please replace the API_URL placeholder with your deployed Google Apps Script web app URL.", variant: "destructive" });
      return false;
    }
    return true;
  }, [toast]);

  useEffect(() => {
    if (!isApiConfigured()) { setIsLoading(false); return; }
    apiPost({ action: "getCurrentActivity", user: USER_ID })
      .then((data) => {
        if (data && data.ok === true && data.activity && typeof data.activity === "object") {
          setCurrentActivity(data.activity as Activity);
        } else {
          setCurrentActivity(null);
        }
      })
      .catch(() => {
        setCurrentActivity(null);
        toast({ title: "Failed to load", description: "Could not fetch current activity. Check API_URL.", variant: "destructive" });
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (transcript) {
      setEditableTranscript(transcript);
      setShowTranscript(true);
    }
  }, [transcript]);

  const handleNewActivity = () => {
    if (isIOS) {
      resetTranscript();
      setEditableTranscript("");
      setShowTranscript(true);
    } else if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setEditableTranscript("");
      setShowTranscript(false);
      startListening();
    }
  };

  const handleSend = async () => {
    if (!editableTranscript.trim() || !guardApi()) return;

    setIsSending(true);
    const payload = {
      action: "createActivity",
      recordId: crypto.randomUUID(),
      user: USER_ID,
      activity: editableTranscript.trim(),
      date: getWinnipegDateString(),
      startTime: getWinnipegTimeString(),
      isActive: true,
      status: "Active",
      createdAt: new Date().toISOString(),
    };
    

    try {
      const result = await apiPost(payload);
      

      if (!result || result.ok !== true) {
        throw new Error("Invalid response: " + JSON.stringify(result));
      }
      const newActivity: Activity = {
        recordId: payload.recordId as string,
        user: payload.user as string,
        activity: payload.activity as string,
        date: payload.date as string,
        startTime: payload.startTime as string,
        endTime: "",
        isActive: true,
        status: "Active",
        createdAt: payload.createdAt as string,
      };
      setCurrentActivity(newActivity);
      setShowTranscript(false);
      setEditableTranscript("");
      resetTranscript();
      toast({ title: "Activity logged", description: newActivity.activity });
    } catch (err: any) {
      const msg = err?.message || String(err);
      toast({ title: "Send failed", description: "Could not save activity. Try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleEndActivity = async () => {
    if (!currentActivity || !guardApi()) return;

    setIsEnding(true);
    const endPayload = { action: "endActivity", user: USER_ID };
    try {
      const result = await apiPost(endPayload);
      
      if (!result || result.ok !== true) {
        throw new Error("Invalid response: " + JSON.stringify(result));
      }
      setCurrentActivity(null);
      toast({ title: "Activity ended", description: "Activity marked as completed." });
    } catch (err: any) {
      const msg = err?.message || String(err);
      
      toast({ title: "End failed", description: "Could not end activity. Try again.", variant: "destructive" });
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center px-4 py-6 max-w-md mx-auto select-none">
      <div
        className="fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgSki})` }}
      />
      <div className="fixed inset-0 -z-10 bg-background/70" />
      <div className="w-full flex justify-end mb-6">
        <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-sm border border-foreground/20 rounded-lg px-3 py-1.5">
          <ExternalLink className="w-3.5 h-3.5" />
          Open Google Sheet
        </a>
      </div>

      <div className="w-full mb-10 border border-foreground/20 rounded-xl p-4 bg-card min-h-[72px] flex items-center">
        {isLoading ? (
          <div className="flex items-center justify-center w-full gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : currentActivity ? (
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Currently Active</p>
              <p className="text-foreground font-medium truncate">{currentActivity.activity}</p>
            </div>
            <Button variant="end" size="sm" onClick={handleEndActivity} disabled={isEnding} className="shrink-0 flex items-center gap-1.5">
              {isEnding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 fill-current" />}
              End
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm w-full text-center">No Activities Currently Active</p>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <Button variant="record" size="round" onClick={handleNewActivity} disabled={!isIOS && !isSupported} className={isListening ? "animate-pulse" : ""}>
          <div className="flex flex-col items-center gap-2">
            {isIOS ? (
              <><Keyboard className="w-8 h-8" /><span className="text-xs">New Activity</span></>
            ) : isListening ? (
              <><MicOff className="w-8 h-8" /><span className="text-xs">Stop</span></>
            ) : (
              <><Mic className="w-8 h-8" /><span className="text-xs">New Activity</span></>
            )}
          </div>
        </Button>
        {!isIOS && !isSupported && (
          <p className="text-destructive text-xs mt-3 text-center">Voice recognition not supported in this browser.<br />Try Safari or Chrome on iPhone.</p>
        )}
      </div>

      {showTranscript && (
        <div className="w-full mt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {isIOS && (
            <p className="text-muted-foreground text-xs text-center">Tap the keyboard mic to dictate</p>
          )}
          <textarea value={editableTranscript} onChange={(e) => setEditableTranscript(e.target.value)} className="w-full bg-card border border-foreground/20 rounded-xl p-4 text-foreground text-base resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]" placeholder="Type or dictate your activity..." autoFocus />
          <Button variant="action" className="w-full h-12 text-base font-semibold" onClick={handleSend} disabled={!editableTranscript.trim() || isSending}>
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
};

export default Index;
