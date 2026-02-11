// ================== SHARED COMBO EXPLOSION WITH SMART GROUPING ==================
// v1.0.20 - Centralized logic used by both poll-orders and webhook-orders
// Handles: whole pizzas, half-and-half (1/2), and mixed combos correctly

export interface FlavorGroup {
  groupId: string;
  flavors: any[];
  isHalf: boolean;
}

export interface PizzaUnit {
  flavors: any[];
  sourceGroups: string[];
}

export interface GroupMapping {
  option_group_id: number;
  option_type: string;
}

/**
 * Classifies flavor groups and merges adjacent half-groups into pizza units.
 * 
 * CASE 1: Same group with "1/2" flavors -> 1 item (no explosion)
 * CASE 2: Different groups all "1/2" -> 1 item (merged halves)
 * CASE 3: Different groups all whole -> N items (explode each)
 * CASE 4: Mixed combo (whole + halves) -> smart grouping
 */
function buildPizzaUnits(flavorGroups: Record<string, any[]>): PizzaUnit[] {
  const groupKeys = Object.keys(flavorGroups).sort(); // Sort by group_id for consistency
  
  if (groupKeys.length <= 1) {
    // Single group = single pizza unit, no explosion
    return [{
      flavors: groupKeys.length === 1 ? flavorGroups[groupKeys[0]] : [],
      sourceGroups: groupKeys,
    }];
  }

  // Classify each group
  const classified: FlavorGroup[] = groupKeys.map(gid => {
    const flavors = flavorGroups[gid];
    const allHalf = flavors.length > 0 && flavors.every((f: any) => {
      const n = (f.name || '').trim();
      return /^(1\/2|½|meia)\s/i.test(n);
    });
    return { groupId: gid, flavors, isHalf: allHalf };
  });

  console.log(`[smartGroup] ${classified.length} flavor groups: [${classified.map(g => g.isHalf ? 'half' : 'whole').join(', ')}]`);

  // Build pizza units by merging adjacent half-groups in pairs
  const pizzaUnits: PizzaUnit[] = [];
  const pendingHalves: FlavorGroup[] = [];

  for (const group of classified) {
    if (group.isHalf) {
      pendingHalves.push(group);
      // A pair of half-groups = 1 pizza meio-a-meio
      if (pendingHalves.length === 2) {
        pizzaUnits.push({
          flavors: pendingHalves.flatMap(g => g.flavors),
          sourceGroups: pendingHalves.map(g => g.groupId),
        });
        pendingHalves.length = 0;
      }
    } else {
      // Flush any unpaired halves before adding whole
      if (pendingHalves.length > 0) {
        pizzaUnits.push({
          flavors: pendingHalves.flatMap(g => g.flavors),
          sourceGroups: pendingHalves.map(g => g.groupId),
        });
        pendingHalves.length = 0;
      }
      // Whole group = its own pizza unit
      pizzaUnits.push({
        flavors: group.flavors,
        sourceGroups: [group.groupId],
      });
    }
  }

  // Flush remaining unpaired halves
  if (pendingHalves.length > 0) {
    pizzaUnits.push({
      flavors: pendingHalves.flatMap(g => g.flavors),
      sourceGroups: pendingHalves.map(g => g.groupId),
    });
  }

  console.log(`[smartGroup] Merged into ${pizzaUnits.length} pizza units: [${pizzaUnits.map(u => u.sourceGroups.length > 1 ? 'half+half' : 'whole').join(', ')}]`);

  return pizzaUnits;
}

export function explodeComboItems(items: any[], edgeKeywords: string[], flavorKeywords: string[], groupMappings?: GroupMapping[]): any[] {
  const result: any[] = [];

  // Build lookup map from option_group_id → type (hybrid classification)
  const mappingMap = new Map<number, string>();
  if (groupMappings) {
    for (const m of groupMappings) {
      mappingMap.set(m.option_group_id, m.option_type);
    }
  }

  for (const item of items) {
    const options = item.options || [];
    if (options.length === 0) {
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // Classify each option as edge, flavor, or complement
    const flavorGroups: Record<string, any[]> = {};
    const edgeOptions: any[] = [];
    const complementOptions: any[] = [];

    for (const opt of options) {
      const name = (opt.name || '').toLowerCase();
      const optGroupId = opt.option_group_id;
      
      // Hybrid: check mapping first, then fallback to keywords
      let isEdge = false;
      let isFlavor = false;
      
      if (optGroupId && mappingMap.has(optGroupId)) {
        const mappedType = mappingMap.get(optGroupId)!;
        opt._type = mappedType;
        isEdge = mappedType === 'edge';
        isFlavor = mappedType === 'flavor';
      } else {
        isEdge = edgeKeywords.some(k =>
          k === '#' ? name.startsWith('#') : name.includes(k.toLowerCase())
        );
        isFlavor = !isEdge && flavorKeywords.some(k =>
          name.includes(k.toLowerCase())
        );
      }

      if (isEdge) {
        edgeOptions.push(opt);
      } else if (isFlavor) {
        const groupId = String(opt.option_group_id || 'default');
        if (!flavorGroups[groupId]) flavorGroups[groupId] = [];
        flavorGroups[groupId].push(opt);
      } else {
        complementOptions.push(opt);
      }
    }

    const flavorGroupKeys = Object.keys(flavorGroups);

    // If 0 or 1 flavor group, no explosion needed
    if (flavorGroupKeys.length <= 1) {
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // === SMART GROUPING: Build pizza units instead of raw group explosion ===
    const pizzaUnits = buildPizzaUnits(flavorGroups);

    // If smart grouping results in a single unit, no explosion needed
    if (pizzaUnits.length <= 1) {
      console.log(`[explodeCombo] "${item.name}": ${flavorGroupKeys.length} groups merged into 1 pizza unit, keeping as single item`);
      result.push({ ...item, _source_item_id: item.item_id || item.name });
      continue;
    }

    // Expand edge options by quantity (e.g. "# Massa Tradicional" qty:2 -> 2 entries)
    const expandedEdges: any[] = [];
    for (const edge of edgeOptions) {
      const qty = edge.quantity || 1;
      for (let i = 0; i < qty; i++) {
        expandedEdges.push({ ...edge, quantity: 1 });
      }
    }

    // Explode: each pizza unit becomes a separate item
    pizzaUnits.forEach((unit, index) => {
      // Pair edge by index (positional distribution)
      const pairedEdge = index < expandedEdges.length ? [expandedEdges[index]] : [];

      const newOptions = [
        ...unit.flavors,
        ...pairedEdge,
        ...(index === 0 ? complementOptions : []),  // complements on first only
      ];

      result.push({
        ...item,
        quantity: 1,
        options: newOptions,
        observation: index === 0 ? item.observation : null,
        _source_item_id: item.item_id || item.name,
      });
    });

    console.log(`[explodeCombo] Exploded "${item.name}" into ${pizzaUnits.length} items (from ${flavorGroupKeys.length} flavor groups)`);
  }

  // Post-explosion: merge complement-only items back into first flavor item from same source
  const finalResult: any[] = [];
  const pendingComplements: any[] = [];

  for (const ri of result) {
    const opts = ri.options || [];
    const hasFlavor = opts.some((o: any) => {
      const n = (o.name || '').toLowerCase();
      return flavorKeywords.some(k => n.includes(k.toLowerCase()));
    });
    const hasEdge = opts.some((o: any) => {
      const n = (o.name || '').toLowerCase();
      return edgeKeywords.some(k => k === '#' ? n.startsWith('#') : n.includes(k.toLowerCase()));
    });

    const sourceId = ri._source_item_id;

    if (!hasFlavor && !hasEdge && finalResult.length > 0
        && finalResult[finalResult.length - 1]._source_item_id === sourceId) {
      pendingComplements.push(...opts);
    } else {
      finalResult.push(ri);
    }
  }

  if (pendingComplements.length > 0 && finalResult.length > 0) {
    finalResult[0].options = [...(finalResult[0].options || []), ...pendingComplements];
    console.log(`[explodeCombo] Merged ${pendingComplements.length} complement options back into first item`);
  }

  // Clean up temporary tracking property
  return finalResult.map(({ _source_item_id, ...rest }) => rest);
}
