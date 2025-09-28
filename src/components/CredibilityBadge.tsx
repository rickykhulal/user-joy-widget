import { Shield, Star, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CredibilityBadgeProps {
  badge: string;
  score: number;
  className?: string;
}

export const CredibilityBadge = ({ badge, score, className }: CredibilityBadgeProps) => {
  const getBadgeConfig = (badgeType: string) => {
    switch (badgeType) {
      case 'trusted_contributor':
        return {
          text: 'Trusted Contributor',
          variant: 'default' as const,
          icon: <Star className="h-3 w-3" />
        };
      case 'low_credibility':
        return {
          text: 'Low Credibility',
          variant: 'destructive' as const,
          icon: <AlertTriangle className="h-3 w-3" />
        };
      default:
        return {
          text: 'Regular User',
          variant: 'secondary' as const,
          icon: <Shield className="h-3 w-3" />
        };
    }
  };

  const config = getBadgeConfig(badge);

  if (badge === 'regular_user' || badge === 'new_user') {
    return null; // Don't show badge for regular users
  }

  return (
    <Badge 
      variant={config.variant}
      className={`flex items-center gap-1 text-xs ${className}`}
      title={`Credibility Score: ${score}`}
    >
      {config.icon}
      {config.text}
    </Badge>
  );
};