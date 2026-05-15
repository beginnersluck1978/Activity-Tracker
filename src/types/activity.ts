export interface Activity {
  recordId: string;
  user: string;
  activity: string;
  date: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  status: "Active" | "Completed";
  createdAt: string;
}
