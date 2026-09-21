precision highp float;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uZones;
uniform sampler2D uBorders;
uniform vec3 uSun;
uniform vec3 uEye;
uniform float uShowZones;
uniform float uSelected;
uniform float uAtmosphere;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUV;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(uEye-vWorld);
  float sun = dot(normal,uSun);
  float facing = max(dot(normal,view),0.0);
  float rim = pow(1.0-facing,3.8);
  if(uAtmosphere>0.5) {
    float strength=pow(1.0-facing,5.0)*0.38;
    vec3 glow=mix(vec3(0.04,0.11,0.3),vec3(0.16,0.49,0.86),smoothstep(-0.25,0.5,sun));
    gl_FragColor=vec4(glow*strength,strength);
    return;
  }
  vec3 day=texture2D(uDay,vUV).rgb;
  vec3 night=texture2D(uNight,vUV).rgb;
  float daylight=smoothstep(-0.06,0.14,sun);
  float diffuse=max(sun,0.0);
  vec3 color=day*(0.024+0.97*pow(diffuse,0.60));
  // Remove the low-valued land background in Black Marble; retain city emissions.
  vec3 lights=max(night-vec3(0.065),vec3(0.0));
  color+=pow(lights,vec3(1.25))*vec3(1.6,1.3,0.88)*(1.0-daylight);
  float water=smoothstep(0.025,0.12,day.b-max(day.r,day.g));
  vec3 halfVector=normalize(uSun+view);
  color+=vec3(0.42,0.51,0.57)*pow(max(dot(normal,halfVector),0.0),65.0)*water*daylight*0.25;
  color+=vec3(0.07,0.25,0.48)*rim*daylight*0.7;
  vec2 encoded=floor(texture2D(uZones,vUV).rg*255.0+0.5);
  float zone=encoded.r+encoded.g*256.0;
  float selected=1.0-step(0.4,abs(zone-uSelected));
  selected*=step(0.5,uSelected);
  color=mix(color,color+vec3(0.22,0.13,0.045),selected*0.4);
  float border=texture2D(uBorders,vUV).a;
  color=mix(color,vec3(0.63,0.72,0.78),border*uShowZones*0.36);
  gl_FragColor=vec4(color,1.0);
}
