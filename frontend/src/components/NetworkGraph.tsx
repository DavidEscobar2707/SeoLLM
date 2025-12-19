import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { QueryExpansion, GraphNode, GraphLink, QueryType } from '../types';
import { TYPE_COLORS, TYPE_LABELS } from '../types';

interface NetworkGraphProps {
  originalQuery: string;
  expansions: QueryExpansion[];
  onNodeClick?: (expansion: QueryExpansion) => void;
}

/**
 * D3.js force-directed network graph for visualizing query expansions.
 */
export function NetworkGraph({ originalQuery, expansions, onNodeClick }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 500 });

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height: Math.min(500, width * 0.7) });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Build and render the graph
  useEffect(() => {
    if (!svgRef.current || expansions.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;

    // Build nodes and links
    const centerNode: GraphNode = {
      id: 'center',
      label: originalQuery,
      type: 'center',
    };

    const expansionNodes: GraphNode[] = expansions.map((exp, i) => ({
      id: `node-${i}`,
      label: exp.query,
      type: exp.type,
      data: exp,
    }));

    const nodes: GraphNode[] = [centerNode, ...expansionNodes];

    const links: GraphLink[] = expansionNodes.map((node) => ({
      source: 'center',
      target: node.id,
    }));

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create container for zoom/pan
    const container = svg.append('g');

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links)
        .id((d: unknown) => (d as GraphNode).id)
        .distance(120)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    // Draw links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    // Create drag behavior
    const dragBehavior = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Draw nodes
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(dragBehavior);

    // Add circles to nodes
    node.append('circle')
      .attr('r', (d) => d.type === 'center' ? 24 : 16)
      .attr('fill', (d) => TYPE_COLORS[d.type])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

    // Add labels to center node only
    node.filter((d) => d.type === 'center')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 40)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#1e293b')
      .text((d) => d.label.length > 30 ? d.label.slice(0, 30) + '...' : d.label);

    // Add type icons/letters to expansion nodes
    node.filter((d) => d.type !== 'center')
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .attr('fill', '#fff')
      .text((d) => d.type.charAt(0).toUpperCase());

    // Mouse events for tooltip
    node.on('mouseenter', (event, d) => {
      if (d.type === 'center') return;
      
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          node: d,
        });
      }
    })
    .on('mouseleave', () => {
      setTooltip(null);
    })
    .on('click', (_, d) => {
      if (d.type !== 'center' && d.data && onNodeClick) {
        onNodeClick(d.data);
      }
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [expansions, originalQuery, dimensions, onNodeClick]);

  // Zoom controls
  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as never,
        1.5
      );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().scaleBy as never,
        0.67
      );
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      d3.select(svgRef.current).transition().call(
        d3.zoom<SVGSVGElement, unknown>().transform as never,
        d3.zoomIdentity.translate(0, 0).scale(1)
      );
    }
  };

  // Count types for legend
  const typeCounts = expansions.reduce((acc, exp) => {
    acc[exp.type] = (acc[exp.type] || 0) + 1;
    return acc;
  }, {} as Record<QueryType, number>);

  return (
    <div ref={containerRef} className="relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 p-1">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-slate-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-slate-600" />
        </button>
        <button
          onClick={handleReset}
          className="p-2 hover:bg-slate-100 rounded transition-colors"
          title="Reset view"
        >
          <Maximize2 className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="text-xs font-medium text-slate-700 mb-2">Query Types</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[type as QueryType] }}
              />
              <span className="text-slate-600">
                {TYPE_LABELS[type as QueryType]} ({count})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-gradient-to-br from-slate-50 to-slate-100"
        style={{ cursor: 'grab' }}
      />

      {/* Tooltip */}
      {tooltip && tooltip.node.type !== 'center' && (
        <div
          className="graph-tooltip"
          style={{
            left: Math.min(tooltip.x + 10, dimensions.width - 250),
            top: Math.min(tooltip.y + 10, dimensions.height - 100),
          }}
        >
          <div className="font-medium text-slate-900 mb-1">
            {tooltip.node.label}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`type-badge type-badge-${tooltip.node.type}`}
            >
              {TYPE_LABELS[tooltip.node.type as QueryType]}
            </span>
          </div>
          {tooltip.node.data && (
            <>
              <div className="text-slate-600 text-xs mb-1">
                <strong>Intent:</strong> {tooltip.node.data.user_intent}
              </div>
              <div className="text-slate-500 text-xs italic">
                Click for more details
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

