import { describe, expect, it } from "vitest";
import { describeEdge, layoutPointerTree, NODE_W, COL_GAP, PAD, type TreeNode } from "../src/lib/anatomy-layout.ts";

const APP: TreeNode = {
  name: "App",
  children: [{ name: "Header" }, { name: "List", children: [{ name: "Item" }, { name: "Item" }] }],
};

describe("layoutPointerTree", () => {
  it("derives child, sibling and return edges from the tree", () => {
    const layout = layoutPointerTree(APP);
    const described = layout.edges.map((e) => describeEdge(layout, e)).sort();
    expect(described).toEqual(
      [
        "App — child → Header",
        "Header — sibling → List",
        "List — child → Item",
        "Item — sibling → Item",
        "Header — return → App",
        "List — return → App",
        "Item — return → List",
        "Item — return → List",
      ].sort(),
    );
  });

  it("centres parents over their children", () => {
    const layout = layoutPointerTree(APP);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const header = byId.get("0.0")!;
    const list = byId.get("0.1")!;
    const item0 = byId.get("0.1.0")!;
    const item1 = byId.get("0.1.1")!;
    const app = byId.get("0")!;

    expect(list.x).toBeCloseTo((item0.x + item1.x) / 2);
    expect(app.x).toBeCloseTo((header.x + list.x) / 2);
  });

  it("never overlaps two nodes", () => {
    const layout = layoutPointerTree(APP);
    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        if (a.y === b.y) {
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(NODE_W + COL_GAP);
        }
      }
    }
  });

  it("a single node has no edges", () => {
    const layout = layoutPointerTree({ name: "Root" });
    expect(layout.nodes).toHaveLength(1);
    expect(layout.edges).toHaveLength(0);
    expect(layout.width).toBe(2 * PAD + NODE_W);
  });

  it("a chain has no siblings", () => {
    const chain: TreeNode = { name: "A", children: [{ name: "B", children: [{ name: "C" }] }] };
    const layout = layoutPointerTree(chain);
    const kinds = layout.edges.map((e) => e.kind);
    expect(kinds.filter((k) => k === "child")).toHaveLength(2);
    expect(kinds.filter((k) => k === "sibling")).toHaveLength(0);
    expect(kinds.filter((k) => k === "return")).toHaveLength(2);

    const xs = new Set(layout.nodes.map((n) => n.x));
    expect(xs.size).toBe(1);
  });
});
