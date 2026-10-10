// BEGIN jrogue startup dynamic descriptors v1
// Registry identity, never the English display string, selects the entity label.
static const char* _dcss_species_label_id(species_type species)
{
    switch (species)
    {
        // SOURCE_SPECIES_MAPPING
    default: return nullptr;
    }
}
static const char* _dcss_job_label_id(job_type job)
{
    switch (job)
    {
        // SOURCE_JOB_MAPPING
    default: return nullptr;
    }
}
static string _dcss_json_string(const string& value)
{
    string result = "\"";
    for (unsigned char byte : value)
    {
        if (byte == '\\' || byte == '"')
        {
            result += '\\';
            result += byte;
        }
        else if (byte < 0x20)
            result += make_stringf("\\u%04x", static_cast<unsigned int>(byte));
        else
            result += byte;
    }
    return result + "\"";
}
static string _dcss_entity_label(const char* domain, const char* identity)
{
    if (!identity)
    {
        fprintf(stderr, "Unreviewed startup entity identity.\n");
        end(1);
    }
    return "{\"kind\":\"entity_label\",\"version\":1,\"upstream\":\"1eebc1a2892e1c89776a0d7a10691f8dac8d9796\",\"domain\":"
        + _dcss_json_string(domain) + ",\"id\":" + _dcss_json_string(identity) + ",\"form\":\"name\"}";
}
static string _dcss_external_actor_label(const string& name)
{
    return "{\"kind\":\"actor_label\",\"version\":1,\"upstream\":\"1eebc1a2892e1c89776a0d7a10691f8dac8d9796\",\"form\":\"name\",\"identity\":{\"visibility\":\"external\",\"name\":"
        + _dcss_json_string(name) + "}}";
}
static string _dcss_startup_dynamic_text(const char* id, const string& params, const string& canonical_english)
{
#ifdef __EMSCRIPTEN__
    if (params.size() > 2047)
    {
        fprintf(stderr, "Native startup descriptor exceeds reviewed bound.\n");
        end(1);
    }
    char text[512] = {};
    const int length = dcss_host_startup_text(id, params.c_str(), text, sizeof(text));
    if (length <= 0 || length >= static_cast<int>(sizeof(text))
        || text[length] != '\0' || string(text, length).find('\0') != string::npos)
    {
        fprintf(stderr, "Native startup localization failed.\n");
        end(1);
    }
    return string(text, length);
#else
    return canonical_english;
#endif
}
static string _dcss_character_params(species_type species, job_type job)
{
    return "{\"species\":" + _dcss_entity_label("species", _dcss_species_label_id(species))
        + ",\"job\":" + _dcss_entity_label("job", _dcss_job_label_id(job)) + "}";
}
// END jrogue startup dynamic descriptors v1

