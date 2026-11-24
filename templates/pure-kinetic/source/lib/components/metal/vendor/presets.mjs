// Original metal-fx 2.0.11 presets; TypeScript annotations erased. MIT.
/**
 * Bundled preset configurations for the metal effect.
 *
 * These sit on top of Paper Shaders' `liquidMetal`, so the parameter set is
 * Paper's, not the old plasma engine's. Baseline values come from Paper's own
 * `fullScreenPreset` ("Backdrop") — the `shape: 'none'` variant, which fills
 * the frame with the material instead of masking it to a circle/daisy/diamond.
 * That's the mode we want: metal-fx carves the ring itself on the 2D canvas
 * (`punchInnerHole`), so the shader should hand us a full sheet of metal.
 *
 * A note on color, because it is the big behavioural change from the plasma
 * engine: Paper hardcodes the stripe endpoints inside the shader to
 * near-white (.98,.98,1.) and near-black (.1,.1,.1). There is no palette to
 * feed. All three presets therefore render the *same* silver material and
 * differ only in `colorTint`, which the shader applies as a colour-burn pass
 * weighted by the tint's alpha. `chromatic` is consequently an approximation
 * — the old 5-stop rainbow is not reproducible here.
 *
 * `colorBack` is composited *under* the material at its own alpha. Keep it
 * fully transparent for ring use, otherwise the punched-out centre fills in.
 *
 * `speed` is applied JS-side to `u_time` before upload (cheaper than a
 * uniform, and it matches how Paper's own mount drives time).
 */

                                                         
                                           

/** Paper's `LiquidMetalShapes`. Only `none` fills the frame. */
export const SHAPE_NONE = 0;
export const SHAPE_CIRCLE = 1;
export const SHAPE_DAISY = 2;
export const SHAPE_DIAMOND = 3;
export const SHAPE_METABALLS = 4;

/** Paper's `ShaderFitOptions`. */
export const FIT_NONE = 0;
export const FIT_CONTAIN = 1;
export const FIT_COVER = 2;

                             
                                                                               
                    
                                                                              
                                                     
                    
                                                                     
                
                                
                     
                                                      
                   
                                      
                   
                                      
                    
                                                         
                     
                                                                
                  
                                                     
                
                                                                                
                
                                
                
                                              
                   
                                       
                  
                  
                                                              
                  
                  
                                                                   
                     
                      
                                            
              
                                                                            
                                                                             
                                                                         
                        
 

                         
                   
                                         
 

/** Paper `fullScreenPreset` values, minus the opaque `#AAAAAC` backdrop. */
const BASE                                                  = {
  colorBack: '#00000000',
  speed: 1,
  repetition: 1.5,
  softness: 0.05,
  shiftRed: 0.3,
  shiftBlue: 0.3,
  distortion: 0.1,
  contour: 0.4,
  angle: 90,
  shape: SHAPE_NONE,
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  originX: 0.5,
  originY: 0.5,
  worldWidth: 0,
  worldHeight: 0,
  fit: FIT_CONTAIN,
};

const CHROMATIC         = {
  name: 'chromatic',
  modes: {
    // Cool blue burn with the dispersion pushed well past Paper's default —
    // the R/B channel split is the only knob that produces colour separation
    // in this shader, so it carries what the 5-stop palette used to do.
    dark: { ...BASE, colorTint: '#88ccff2e', shiftRed: 0.75, shiftBlue: 0.75, repetition: 2, softness: 0.09, shaderOpacity: 1 },
    light: { ...BASE, colorTint: '#66b0ff99', shiftRed: 0.6, shiftBlue: 0.6, shaderOpacity: 1 },
  },
};

const SILVER         = {
  name: 'silver',
  modes: {
    // White tint at low amount = Paper's material essentially untouched.
    dark: { ...BASE, colorTint: '#ffffff66', shaderOpacity: 0.88 },
    light: { ...BASE, colorTint: '#ffffff40', shaderOpacity: 1 },
  },
};

const GOLD         = {
  name: 'gold',
  modes: {
    dark: { ...BASE, colorTint: '#ffcc55cc', speed: 0.85, shaderOpacity: 0.92 },
    light: { ...BASE, colorTint: '#f7d488aa', shaderOpacity: 1 },
  },
};

export const PRESETS                             = {
  chromatic: CHROMATIC,
  silver: SILVER,
  gold: GOLD,
};
