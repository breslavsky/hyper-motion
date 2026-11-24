// A surface material changes rendering, never the brand or the scene recipe.
const MATERIALS = Object.freeze(['glass', 'dark-glass', 'metal']);

function materialProblems(film) {
  if (film.material === undefined) return [];
  const errors = [];
  if (!MATERIALS.includes(film.material)) errors.push(`"material" must be one of ${MATERIALS.join(', ')}`);
  if (film.metalVariant !== undefined) errors.push('"material" cannot be combined with "metalVariant"; the material uses the brand colours');
  if (Array.isArray(film.scenes)) film.scenes.forEach((scene, index) => {
    if (scene?.metalVariant !== undefined) errors.push(`scenes[${index}].metalVariant cannot be combined with film.material; the material uses the brand colours`);
  });
  return errors;
}

function resolveMaterialLook(look, material) {
  if (material === undefined) return look;
  if (!MATERIALS.includes(material)) throw new Error(`"material" must be one of ${MATERIALS.join(', ')}`);
  return {...look, material: {type: material, ...(material === 'metal' ? {variant: 'silver'} : {}), branded: true}};
}

module.exports = {MATERIALS, materialProblems, resolveMaterialLook};
