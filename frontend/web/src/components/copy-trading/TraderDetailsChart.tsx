'use client';

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ChartMetric } from '@/types/trader';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TraderDetailsChartProps {
  metric: ChartMetric;
}

export default function TraderDetailsChart({ metric }: TraderDetailsChartProps) {
  // Generate mock data based on the metric
  const generateData = () => {
    const days = 30;
    const dates = [];
    const values = [];
    
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
      
      // Generate realistic looking data
      let value = 0;
      if (metric === 'ROI') {
        // Start low, dip down, then recover and go up
        if (i > 20) {
          value = -2 + Math.random() * 2;
        } else if (i > 15) {
          value = -5 - Math.random() * 10;
        } else if (i > 10) {
          value = -8 + (20 - i) * 2;
        } else if (i > 5) {
          value = 5 + (15 - i) * 1.5;
        } else {
          value = 18 + Math.random() * 3;
        }
      } else if (metric === 'Cumulative PnL') {
        // Similar pattern but scaled to PnL values
        if (i > 20) {
          value = -1000 + Math.random() * 1000;
        } else if (i > 15) {
          value = -5000 - Math.random() * 10000;
        } else if (i > 10) {
          value = -8000 + (20 - i) * 2000;
        } else if (i > 5) {
          value = 10000 + (15 - i) * 3000;
        } else {
          value = 48000 + Math.random() * 5000;
        }
      } else {
        // Account Assets - generally increasing
        value = 200000 + (days - i) * 1500 + Math.random() * 5000;
      }
      
      values.push(value);
    }
    
    return { dates, values };
  };

  const { dates, values } = useMemo(() => generateData(), [metric]);

  const data = {
    labels: dates,
    datasets: [
      {
        label: metric,
        data: values,
        borderColor: 'rgba(79, 70, 229, 1)',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
          gradient.addColorStop(0.5, 'rgba(79, 70, 229, 0.2)');
          gradient.addColorStop(1, 'rgba(79, 70, 229, 0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: 'rgba(79, 70, 229, 1)',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(16, 16, 16, 0.95)',
        titleColor: 'rgba(255, 255, 255, 0.6)',
        bodyColor: '#fff',
        borderColor: 'rgba(41, 45, 50, 1)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: function(context) {
            let label = '';
            const value = context.parsed.y;
            if (value === null) return '';
            
            if (metric === 'ROI') {
              label = value.toFixed(2) + '%';
            } else if (metric === 'Cumulative PnL') {
              label = '$' + value.toFixed(2);
            } else {
              label = '$' + value.toLocaleString();
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          maxTicksLimit: 6,
          font: {
            size: 11,
          },
        },
        border: {
          display: false,
        },
      },
      y: {
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          maxTicksLimit: 6,
          font: {
            size: 11,
          },
          callback: function(value) {
            if (metric === 'ROI') {
              return value + '%';
            } else if (metric === 'Cumulative PnL') {
              return '$' + (value as number).toFixed(0);
            } else {
              const num = value as number;
              return '$' + (num / 1000).toFixed(0) + 'K';
            }
          },
        },
        border: {
          display: false,
        },
      },
    },
  };

  return <Line data={data} options={options} />;
}

