import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { Dashboard as CWDashboard, IWidget, TextWidget, GraphWidget, LogQueryWidget, AlarmWidget, SingleValueWidget, PeriodOverride, TextWidgetBackground } from 'aws-cdk-lib/aws-cloudwatch';
import type { IAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import type { IMetric } from 'aws-cdk-lib/aws-cloudwatch';

/**
 * Configuration options for the Dashboard construct
 */
export interface DashboardProps {
    /**
     * Name of the dashboard
     * @default - auto-generated name
     */
    readonly dashboardName?: string;

    /**
     * Interval duration for graphs
     * @default - all graphs will default to 300 (5 minutes)
     */
    readonly periodOverride?: PeriodOverride;

    /**
     * The start of the time range to use for each widget on the dashboard
     * @default - When the dashboard loads, the start time will be the default time range
     */
    readonly start?: string;

    /**
     * The end of the time range to use for each widget on the dashboard
     * @default - When the dashboard loads, the end time will be the default time range
     */
    readonly end?: string;

    /**
     * Default widget height
     * @default 6
     */
    readonly defaultWidgetHeight?: number;

    /**
     * Default widget width
     * @default 6
     */
    readonly defaultWidgetWidth?: number;
}

/**
 * Grid position for a widget
 */
export interface GridPosition {
    readonly x?: number;
    readonly y?: number;
    readonly width?: number;
    readonly height?: number;
}

/**
 * CloudWatch Dashboard construct with grid layout and heading support
 * 
 * @example
 * ```typescript
 * const dashboard = new Dashboard(this, 'MyDashboard', {
 *   dashboardName: 'my-application-dashboard',
 * });
 * 
 * // Add a heading
 * dashboard.addHeading('Application Metrics', 24);
 * 
 * // Add widgets in a grid
 * dashboard.addWidget(metricWidget, { width: 12, height: 6 });
 * dashboard.addWidget(logWidget, { width: 12, height: 6 });
 * ```
 */
export class Dashboard extends Construct {
    /**
     * The underlying CloudWatch Dashboard
     */
    public readonly dashboard: CWDashboard;

    /**
     * Default widget dimensions
     */
    private readonly defaultWidth: number;
    private readonly defaultHeight: number;

    /**
     * Current grid position tracker
     */
    private currentX: number = 0;
    private currentY: number = 0;
    private currentRowHeight: number = 0;

    /**
     * Grid width (CloudWatch dashboards use 24 units)
     */
    private readonly GRID_WIDTH = 24;

    constructor(scope: Construct, id: string, props: DashboardProps = {}) {
        super(scope, id);

        this.defaultWidth = props.defaultWidgetWidth ?? 6;
        this.defaultHeight = props.defaultWidgetHeight ?? 6;

        this.dashboard = new CWDashboard(this, 'Dashboard', {
            dashboardName: props.dashboardName,
            periodOverride: props.periodOverride,
            start: props.start,
            end: props.end,
        });
    }

    /**
     * Add a heading/section title to the dashboard
     * 
     * @param text The heading text (supports markdown)
     * @param width Width in grid units (default: 24 - full width)
     * @param height Height in grid units (default: 1)
     * @param background Background style (default: TextWidgetBackground.TRANSPARENT)
     * 
     * @example
     * ```typescript
     * dashboard.addHeading('## Application Metrics');
     * dashboard.addHeading('Database Performance', 12, 2);
     * dashboard.addHeading('## Solid Background', 24, 1, TextWidgetBackground.SOLID);
     * ```
     */
    public addHeading(text: string, width: number = 24, height: number = 1, background: TextWidgetBackground = TextWidgetBackground.TRANSPARENT): void {
        const widget = new TextWidget({
            markdown: text,
            width,
            height,
            background,
        });

        this.addWidget(widget, { width, height });
    }

    /**
     * Add a widget to the dashboard with automatic grid positioning
     * 
     * @param widget The CloudWatch widget to add
     * @param position Optional grid position (width, height, x, y)
     * 
     * @example
     * ```typescript
     * dashboard.addWidget(new GraphWidget({
     *   title: 'CPU Usage',
     *   left: [metric],
     * }), { width: 12, height: 6 });
     * ```
     */
    public addWidget(widget: IWidget, position?: GridPosition): void {
        const width = position?.width ?? this.defaultWidth;
        const height = position?.height ?? this.defaultHeight;

        // If explicit position is provided, use it
        if (position?.x !== undefined && position?.y !== undefined) {
            this.dashboard.addWidgets(widget);
            return;
        }

        // Auto-position: check if widget fits in current row
        if (this.currentX + width > this.GRID_WIDTH) {
            // Move to next row
            this.currentX = 0;
            this.currentY += this.currentRowHeight;
            this.currentRowHeight = 0;
        }

        // Add widget at current position
        this.dashboard.addWidgets(widget);

        // Update position tracker
        this.currentX += width;
        this.currentRowHeight = Math.max(this.currentRowHeight, height);

        // If we've filled the row, move to next
        if (this.currentX >= this.GRID_WIDTH) {
            this.currentX = 0;
            this.currentY += this.currentRowHeight;
            this.currentRowHeight = 0;
        }
    }

    /**
     * Add multiple widgets in a row
     * 
     * @param widgets Array of widgets to add horizontally
     * 
     * @example
     * ```typescript
     * dashboard.addRow([widget1, widget2, widget3]);
     * ```
     */
    public addRow(widgets: IWidget[]): void {
        // Start new row
        if (this.currentX !== 0) {
            this.currentX = 0;
            this.currentY += this.currentRowHeight;
            this.currentRowHeight = 0;
        }

        // Add all widgets at once to place them side-by-side
        this.dashboard.addWidgets(...widgets);

        // Update grid position tracker
        const widgetWidth = Math.floor(this.GRID_WIDTH / widgets.length);
        this.currentX = 0;
        this.currentY += this.defaultHeight;
        this.currentRowHeight = 0;
    }

    /**
     * Add a section with a heading and widgets
     * 
     * @param heading The section heading
     * @param widgets Array of widgets for this section
     * @param widgetsPerRow Number of widgets per row (default: 2)
     * 
     * @example
     * ```typescript
     * dashboard.addSection('API Metrics', [
     *   latencyWidget,
     *   errorWidget,
     *   requestWidget,
     *   throughputWidget,
     * ], 2);
     * ```
     */
    public addSection(heading: string, widgets: IWidget[], widgetsPerRow: number = 2): void {
        this.addHeading(`## ${heading}`);

        const widgetWidth = Math.floor(this.GRID_WIDTH / widgetsPerRow);

        widgets.forEach(widget => {
            this.addWidget(widget, { width: widgetWidth });
        });
    }

    /**
     * Create a metric graph widget
     * 
     * @param title Widget title
     * @param metrics Array of metrics to display
     * @param options Additional widget options
     * 
     * @example
     * ```typescript
     * const widget = dashboard.createGraphWidget('API Latency', [metric], {
     *   width: 12,
     *   height: 6,
     * });
     * ```
     */
    public createGraphWidget(
        title: string,
        metrics: IMetric[],
        options?: {
            width?: number;
            height?: number;
            stacked?: boolean;
            period?: Duration;
            statistic?: string;
            leftYAxis?: any;
            rightYAxis?: any;
        }
    ): GraphWidget {
        return new GraphWidget({
            title,
            left: metrics,
            width: options?.width ?? this.defaultWidth,
            height: options?.height ?? this.defaultHeight,
            stacked: options?.stacked,
            period: options?.period,
            statistic: options?.statistic,
            leftYAxis: options?.leftYAxis,
            rightYAxis: options?.rightYAxis,
        });
    }

    /**
     * Create a single value widget
     * 
     * @param title Widget title
     * @param metrics Array of metrics to display
     * @param options Additional widget options
     */
    public createSingleValueWidget(
        title: string,
        metrics: IMetric[],
        options?: {
            width?: number;
            height?: number;
        }
    ): SingleValueWidget {
        return new SingleValueWidget({
            title,
            metrics,
            width: options?.width ?? this.defaultWidth,
            height: options?.height ?? this.defaultHeight,
        });
    }

    /**
     * Create an alarm widget
     * 
     * @param title Widget title
     * @param alarms Array of alarms to display
     * @param options Additional widget options
     */
    public createAlarmWidget(
        title: string,
        alarms: IAlarm[],
        options?: {
            width?: number;
            height?: number;
        }
    ): AlarmWidget {
        return new AlarmWidget({
            title,
            alarm: alarms[0],
            width: options?.width ?? this.defaultWidth,
            height: options?.height ?? this.defaultHeight,
        });
    }

    /**
     * Create a log query widget
     * 
     * @param title Widget title
     * @param logGroupNames Array of log group names
     * @param queryString CloudWatch Insights query string
     * @param options Additional widget options
     */
    public createLogQueryWidget(
        title: string,
        logGroupNames: string[],
        queryString: string,
        options?: {
            width?: number;
            height?: number;
        }
    ): LogQueryWidget {
        return new LogQueryWidget({
            title,
            logGroupNames,
            queryString,
            width: options?.width ?? this.defaultWidth,
            height: options?.height ?? this.defaultHeight,
        });
    }

    /**
     * Create a text widget (for custom markdown content)
     * 
     * @param markdown Markdown content
     * @param options Additional widget options
     */
    public createTextWidget(
        markdown: string,
        options?: {
            width?: number;
            height?: number;
            background?: TextWidgetBackground;
        }
    ): TextWidget {
        return new TextWidget({
            markdown,
            width: options?.width ?? this.GRID_WIDTH,
            height: options?.height ?? 2,
            background: options?.background ?? TextWidgetBackground.TRANSPARENT,
        });
    }

    /**
     * Reset the grid position to start a new layout section
     */
    public resetGridPosition(): void {
        this.currentX = 0;
        this.currentY = 0;
        this.currentRowHeight = 0;
    }
}