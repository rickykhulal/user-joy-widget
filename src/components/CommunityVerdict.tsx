import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface CommunityVerdictProps {
  postId: string;
  notesCount: number;
  verdict: 'likely_real' | 'likely_fake' | 'mixed' | 'no_verdict';
}

export const CommunityVerdict = ({ postId, notesCount, verdict }: CommunityVerdictProps) => {
  const getVerdictConfig = (verdictType: string) => {
    switch (verdictType) {
      case 'likely_real':
        return {
          text: 'Likely Real',
          className: 'bg-success text-success-foreground',
          icon: <CheckCircle className="h-4 w-4" />
        };
      case 'likely_fake':
        return {
          text: 'Likely Fake',
          className: 'bg-destructive text-destructive-foreground',
          icon: <XCircle className="h-4 w-4" />
        };
      case 'mixed':
        return {
          text: 'Mixed/Unclear',
          className: 'bg-warning text-warning-foreground',
          icon: <AlertCircle className="h-4 w-4" />
        };
      default:
        return {
          text: 'No Community Verdict',
          className: 'bg-muted text-muted-foreground',
          icon: <AlertCircle className="h-4 w-4" />
        };
    }
  };

  if (notesCount === 0) {
    return null;
  }

  const config = getVerdictConfig(verdict);

  return (
    <div className={`rounded-lg p-3 mb-4 ${config.className}`}>
      <div className="flex items-center gap-2 mb-1">
        {config.icon}
        <span className="font-semibold">Community Verdict</span>
      </div>
      <div className="text-sm">
        {config.text} • Based on {notesCount} community note{notesCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
};