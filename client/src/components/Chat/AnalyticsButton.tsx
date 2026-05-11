import { memo, useCallback } from 'react';
import { BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, TooltipAnchor } from '@librechat/client';
import { cn } from '~/utils';
import { useLocalize } from '~/hooks';

function AnalyticsButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const localize = useLocalize();

  const handleNavigate = useCallback(() => {
    navigate('/analytics');
  }, [navigate]);

  const label = localize('com_ui_interaction_analytics_nav');

  return (
    <TooltipAnchor
      description={label}
      render={
        <Button
          variant="outline"
          type="button"
          aria-label={label}
          data-testid="analytics-button"
          className={cn(
            'rounded-full border-none bg-transparent p-2 hover:bg-surface-hover md:rounded-xl',
            className,
          )}
          onClick={handleNavigate}
        >
          <BarChart3 className="icon-lg text-text-primary" aria-hidden="true" />
        </Button>
      }
    />
  );
}

export default memo(AnalyticsButton);
