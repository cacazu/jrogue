/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 jrogue contributors
 *
 * Independently authored GLU sphere subset for retained ToME's browser renderer.
 * API declarations come from the SDK's GL/glu.h; no SGI implementation is copied.
 * Only the five functions used by ToME 1.7.6 core_lua.c are supplied here.
 */
#include <GL/glu.h>
#include <math.h>
#include <stdlib.h>

struct GLUquadric {
    GLenum normals;
    GLboolean texture;
};

typedef struct {
    GLdouble x, y, z;
    GLdouble s, t;
} SpherePoint;

static const GLdouble tome_pi = 3.14159265358979323846264338327950288;

GLUquadric *GLAPIENTRY gluNewQuadric(void)
{
    GLUquadric *quad = (GLUquadric *)malloc(sizeof(*quad));
    if (quad) {
        quad->normals = GLU_SMOOTH;
        quad->texture = GL_FALSE;
    }
    return quad;
}

void GLAPIENTRY gluDeleteQuadric(GLUquadric *quad)
{
    free(quad);
}

void GLAPIENTRY gluQuadricNormals(GLUquadric *quad, GLenum normals)
{
    if (quad && (normals == GLU_SMOOTH || normals == GLU_FLAT || normals == GLU_NONE))
        quad->normals = normals;
}

void GLAPIENTRY gluQuadricTexture(GLUquadric *quad, GLboolean texture)
{
    if (quad)
        quad->texture = texture ? GL_TRUE : GL_FALSE;
}

static SpherePoint sphere_point(GLint slice, GLint stack, GLint slices, GLint stacks)
{
    SpherePoint point;
    GLdouble latitude, longitude, ring;
    point.s = (GLdouble)slice / (GLdouble)slices;
    point.t = (GLdouble)stack / (GLdouble)stacks;
    latitude = tome_pi * (1.0 - point.t);
    /* Duplicate the seam with different s values but identical position/normal. */
    longitude = slice == slices ? 0.0 : 2.0 * tome_pi * point.s;
    ring = sin(latitude);
    point.x = sin(longitude) * ring;
    point.y = cos(longitude) * ring;
    point.z = cos(latitude);
    /* Exact poles avoid tiny floating-point cracks and degenerate cap faces. */
    if (stack == 0 || stack == stacks) {
        point.x = point.y = 0.0;
        point.z = stack == 0 ? -1.0 : 1.0;
    }
    return point;
}

static void emit_point(const GLUquadric *quad, GLdouble radius, const SpherePoint *point)
{
    if (quad->normals == GLU_SMOOTH)
        glNormal3f((GLfloat)point->x, (GLfloat)point->y, (GLfloat)point->z);
    if (quad->texture)
        glTexCoord2f((GLfloat)point->s, (GLfloat)point->t);
    glVertex3f((GLfloat)(radius * point->x), (GLfloat)(radius * point->y),
               (GLfloat)(radius * point->z));
}

static void emit_triangle(const GLUquadric *quad, GLdouble radius,
                          const SpherePoint *a, const SpherePoint *b, const SpherePoint *c)
{
    if (quad->normals == GLU_FLAT) {
        /* Cross unit-sphere edges, independent of radius (including radius 0). */
        GLdouble ux = b->x - a->x, uy = b->y - a->y, uz = b->z - a->z;
        GLdouble vx = c->x - a->x, vy = c->y - a->y, vz = c->z - a->z;
        GLdouble nx = uy * vz - uz * vy;
        GLdouble ny = uz * vx - ux * vz;
        GLdouble nz = ux * vy - uy * vx;
        GLdouble length = sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 0.0)
            glNormal3f((GLfloat)(nx / length), (GLfloat)(ny / length), (GLfloat)(nz / length));
    }
    emit_point(quad, radius, a);
    emit_point(quad, radius, b);
    emit_point(quad, radius, c);
}

void GLAPIENTRY gluSphere(GLUquadric *quad, GLdouble radius, GLint slices, GLint stacks)
{
    GLint stack, slice;
    if (!quad || !isfinite(radius) || radius < 0.0 || slices < 3 || stacks < 2)
        return;

    /* GLU default FILL/OUTSIDE: counterclockwise triangles seen from outside.
     * z is the polar axis; s advances +Y,+X,-Y,-X,+Y and t south-to-north.
     * No texture, transform, color, lighting, or other GL enable state is changed.
     */
    glBegin(GL_TRIANGLES);
    for (stack = 0; stack < stacks; ++stack) {
        for (slice = 0; slice < slices; ++slice) {
            SpherePoint a = sphere_point(slice, stack, slices, stacks);
            SpherePoint b = sphere_point(slice, stack + 1, slices, stacks);
            SpherePoint c = sphere_point(slice + 1, stack, slices, stacks);
            SpherePoint d = sphere_point(slice + 1, stack + 1, slices, stacks);
            if (stack > 0)
                emit_triangle(quad, radius, &a, &b, &c);
            if (stack + 1 < stacks)
                emit_triangle(quad, radius, &c, &b, &d);
        }
    }
    glEnd();
}
