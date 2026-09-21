precision highp float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uEarthRotation;
uniform float uRadius;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUV;
void main() {
  vWorld = uEarthRotation * aPosition * uRadius;
  vNormal = normalize(uEarthRotation * aNormal);
  vUV = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(vWorld, 1.0);
}
