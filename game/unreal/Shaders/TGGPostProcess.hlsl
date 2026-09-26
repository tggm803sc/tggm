// TGG branchless chromatic-aberration vignette.
// Intended for an Unreal Custom node or equivalent post-process integration.

float4 TGGPostProcess(float2 UV, Texture2D SceneTexture, SamplerState SceneSampler, float Aberration, float VignetteStrength)
{
    float2 centered = UV * 2.0 - 1.0;
    float radius2 = dot(centered, centered);
    float2 radial = normalize(centered + 1e-6) * Aberration * radius2;

    float r = SceneTexture.Sample(SceneSampler, UV + radial).r;
    float g = SceneTexture.Sample(SceneSampler, UV).g;
    float b = SceneTexture.Sample(SceneSampler, UV - radial).b;

    float vignette = saturate(1.0 - radius2 * VignetteStrength);
    return float4(float3(r, g, b) * vignette, 1.0);
}
