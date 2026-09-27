// Lays out a nested tree as a pointer diagram: boxes at (x, y) plus the
// child / sibling / return edges React's fiber tree is walked with.
//
// A node's `id` is its path from the root ("0", "0.1", "0.1.0", ...), so
// duplicate names are fine and edges can reference nodes unambiguously.
// Leaves are placed left to right in depth-first order; each parent is
// centred over the x-span of its own children, recursively up to the root.

export interface TreeNode {
  name: string;
  children?: TreeNode[];
}

export type EdgeKind = "child" | "sibling" | "return";

export interface LaidOutNode {
  id: string;
  name: string;
  x: number; // box centre
  y: number; // box centre
}

export interface TreeEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface TreeLayout {
  nodes: LaidOutNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
}

export const NODE_W = 96;
export const NODE_H = 36;
export const COL_GAP = 24;
export const ROW_GAP = 56;
export const PAD = 16;

export function layoutPointerTree(tree: TreeNode): TreeLayout {
  const nodes: LaidOutNode[] = [];
  const edges: TreeEdge[] = [];
  let nextCol = 0;
  let maxDepth = 0;

  // First pass: assign x to leaves in depth-first order, x to parents as the
  // midpoint of their children, and collect edges. Recursion returns the
  // node's own x so its parent can centre over it.
  function visit(node: TreeNode, id: string, depth: number): number {
    maxDepth = Math.max(maxDepth, depth);
    const children = node.children ?? [];

    let x: number;
    if (children.length === 0) {
      const col = nextCol++;
      x = PAD + col * (NODE_W + COL_GAP) + NODE_W / 2;
    } else {
      const childXs = children.map((child, i) => visit(child, `${id}.${i}`, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    }

    const y = PAD + depth * (NODE_H + ROW_GAP) + NODE_H / 2;
    nodes.push({ id, name: node.name, x, y });

    children.forEach((_child, i) => {
      const childId = `${id}.${i}`;
      if (i === 0) edges.push({ from: id, to: childId, kind: "child" });
      else edges.push({ from: `${id}.${i - 1}`, to: childId, kind: "sibling" });
      edges.push({ from: childId, to: id, kind: "return" });
    });

    return x;
  }

  visit(tree, "0", 0);

  const leaves = Math.max(nextCol, 1);
  const rows = maxDepth + 1;
  const width = 2 * PAD + leaves * NODE_W + (leaves - 1) * COL_GAP;
  const height = 2 * PAD + rows * NODE_H + (rows - 1) * ROW_GAP;

  return { nodes, edges, width, height };
}

export function describeEdge(layout: TreeLayout, edge: TreeEdge): string {
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  const from = byId.get(edge.from)?.name ?? edge.from;
  const to = byId.get(edge.to)?.name ?? edge.to;
  return `${from} — ${edge.kind} → ${to}`;
}
