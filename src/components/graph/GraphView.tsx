import React, { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { invoke } from '@tauri-apps/api/core';

interface Node {
  id: string;
  group: string;
  name: string;
  val: number;
}

interface Link {
  source: string;
  target: string;
  value: number;
}

export const GraphView: React.FC = () => {
  const [data, setData] = useState({ nodes: [], links: [] });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 });

  useEffect(() => {
     if (containerRef.current) {
         setDimensions({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
     }

     const handleResize = () => {
         if (containerRef.current) {
             setDimensions({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
         }
     };

     window.addEventListener('resize', handleResize);
     return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function fetchData() {
        try {
            // Get data from backend
            const characters: any[] = await invoke('get_characters');
            const locations: any[] = await invoke('get_locations');
            const relationships: any[] = await invoke('get_relationships');

            const nodes: any[] = [
                ...characters.map(c => ({ id: c.name, group: 'character', name: c.name, val: 5 })),
                ...locations.map(l => ({ id: l.name, group: 'location', name: l.name, val: 3 }))
            ];

            // Deduplicate nodes
            const uniqueNodesMap = new Map();
            nodes.forEach(n => uniqueNodesMap.set(n.id, n));
            const uniqueNodes = Array.from(uniqueNodesMap.values());

            const links: any[] = relationships.map(r => ({
                source: r.from_id,
                target: r.to_id,
                value: 1
            }));

            setData({ nodes: uniqueNodes, links });
        } catch (e) {
            console.error(e);
        }
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 border-t border-gray-200 overflow-hidden relative">
       {/* Use key to force re-render if dimensions change significantly, but ForceGraph usually handles it */}
       {dimensions.w > 0 && dimensions.h > 0 && (
           <ForceGraph2D
              width={dimensions.w}
              height={dimensions.h}
              graphData={data}
              nodeAutoColorBy="group"
              nodeLabel="name"
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              linkColor={() => '#999'}
           />
       )}
    </div>
  );
};
