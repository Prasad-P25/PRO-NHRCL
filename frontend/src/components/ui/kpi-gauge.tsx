import { cn } from '@/lib/utils';

interface KPIGaugeProps {
  value: number;
  target?: number;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
  showTarget?: boolean;
  invertColors?: boolean; // For metrics where lower is better (e.g., incidents)
  className?: string;
}

export function KPIGauge({
  value,
  target,
  min = 0,
  max = 100,
  label,
  unit = '',
  size = 'md',
  showTarget = true,
  invertColors = false,
  className,
}: KPIGaugeProps) {
  // Handle NaN/undefined values
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeTarget = Number.isFinite(target) ? target : undefined;
  const hasData = Number.isFinite(value);

  // Calculate percentage for the gauge
  const clampedValue = Math.max(min, Math.min(max, safeValue));
  const percentage = max > min ? ((clampedValue - min) / (max - min)) * 100 : 0;

  // Size configurations
  const sizeConfig = {
    sm: { width: 130, height: 85, radius: 48, stroke: 10, valueSize: 18, labelSize: 11, unitSize: 10 },
    md: { width: 150, height: 100, radius: 58, stroke: 12, valueSize: 24, labelSize: 12, unitSize: 11 },
    lg: { width: 180, height: 120, radius: 70, stroke: 14, valueSize: 30, labelSize: 14, unitSize: 12 },
  };

  const config = sizeConfig[size];
  const centerX = config.width / 2;
  const centerY = config.height - 10;

  // Arc calculations
  const circumference = Math.PI * config.radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine color based on performance
  const getColor = () => {
    if (!hasData) return '#9CA3AF'; // gray for no data

    const effectiveTarget = safeTarget ?? max;
    const ratio = invertColors
      ? effectiveTarget / (safeValue || 1)
      : safeValue / (effectiveTarget || 1);

    if (ratio >= 1) return '#22C55E'; // green
    if (ratio >= 0.8) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  // Format display value
  const displayValue = hasData
    ? safeValue % 1 === 0 ? safeValue.toString() : safeValue.toFixed(1)
    : '-';

  // Format target display
  const displayTarget = safeTarget !== undefined
    ? (safeTarget % 1 === 0 ? safeTarget.toString() : safeTarget.toFixed(1))
    : null;

  return (
    <div className={cn('flex flex-col items-center min-w-[140px] flex-1', className)}>
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
      >
        {/* Background track */}
        <path
          d={`M ${centerX - config.radius} ${centerY} A ${config.radius} ${config.radius} 0 0 1 ${centerX + config.radius} ${centerY}`}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={config.stroke}
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d={`M ${centerX - config.radius} ${centerY} A ${config.radius} ${config.radius} 0 0 1 ${centerX + config.radius} ${centerY}`}
          fill="none"
          stroke={getColor()}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />

        {/* Target marker on arc */}
        {showTarget && safeTarget !== undefined && max > min && (
          (() => {
            const targetPct = Math.max(0, Math.min(100, ((safeTarget - min) / (max - min)) * 100));
            // Angle goes from 180° (left) to 0° (right), so we map percentage to that range
            const angle = 180 - (targetPct / 100) * 180;
            const radians = (angle * Math.PI) / 180;
            const markerX = centerX + config.radius * Math.cos(radians);
            const markerY = centerY - config.radius * Math.sin(radians);
            return (
              <circle
                cx={markerX}
                cy={markerY}
                r={5}
                fill="#1F2937"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            );
          })()
        )}

        {/* Value text */}
        <text
          x={centerX}
          y={centerY - config.radius / 2.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={hasData ? '#111827' : '#9CA3AF'}
          fontSize={config.valueSize}
          fontWeight="bold"
        >
          {displayValue}
        </text>

        {/* Unit text */}
        {unit && (
          <text
            x={centerX}
            y={centerY - config.radius / 2.5 + config.valueSize - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#6B7280"
            fontSize={config.unitSize}
          >
            {unit}
          </text>
        )}
      </svg>

      {/* Label */}
      <span
        className="text-muted-foreground text-center leading-tight mt-1"
        style={{ fontSize: config.labelSize }}
        title={label}
      >
        {label}
      </span>

      {/* Target display */}
      {showTarget && displayTarget !== null && (
        <span className="text-xs text-muted-foreground">
          Target: {displayTarget}{unit}
        </span>
      )}
    </div>
  );
}

interface KPIGaugeGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function KPIGaugeGroup({ title, description, children, className }: KPIGaugeGroupProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {(title || description) && (
        <div className="text-center md:text-left">
          {title && <h3 className="font-semibold text-sm">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2 justify-start">
        {children}
      </div>
    </div>
  );
}
