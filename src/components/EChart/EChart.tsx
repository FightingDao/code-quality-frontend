import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

interface EChartProps {
  option: echarts.EChartsOption
  height?: number | string
  notMerge?: boolean
}

export function EChart({ option, height = 280, notMerge = true }: EChartProps) {
  const domRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!domRef.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(domRef.current)
    }
    chartRef.current.setOption(option, notMerge)
  }, [option, notMerge])

  useEffect(() => {
    const handleResize = () => chartRef.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  return <div ref={domRef} style={{ width: '100%', height }} />
}

export { echarts }
