/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 jrogue contributors
 * Test-only OpenGL command recorder; never link this file into the game.
 */
#include <GL/glu.h>
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

typedef struct {
    GLfloat x, y, z, nx, ny, nz, s, t;
} RecordedVertex;
static RecordedVertex vertices[25000], previous[25000];
static GLfloat nx, ny, nz, tex_s, tex_t;
static int vertex_count, normal_count, texture_count, begins, ends;

void GLAPIENTRY glBegin(GLenum mode) { assert(mode == GL_TRIANGLES); ++begins; }
void GLAPIENTRY glEnd(void) { ++ends; }
void GLAPIENTRY glNormal3f(GLfloat x, GLfloat y, GLfloat z)
{ nx = x; ny = y; nz = z; ++normal_count; }
void GLAPIENTRY glTexCoord2f(GLfloat s, GLfloat t)
{ tex_s = s; tex_t = t; ++texture_count; }
void GLAPIENTRY glVertex3f(GLfloat x, GLfloat y, GLfloat z)
{
    assert(vertex_count < (int)(sizeof(vertices) / sizeof(vertices[0])));
    RecordedVertex *v = &vertices[vertex_count++];
    v->x = x; v->y = y; v->z = z;
    v->nx = nx; v->ny = ny; v->nz = nz; v->s = tex_s; v->t = tex_t;
}

static void reset(void)
{
    vertex_count = normal_count = texture_count = begins = ends = 0;
    nx = ny = nz = tex_s = tex_t = 0;
}

static double length(double x, double y, double z) { return sqrt(x*x + y*y + z*z); }
static int near(double a, double b) { return fabs(a - b) < 0.00001; }

static void verify_mesh(double radius, int smooth, int textured)
{
    const double pi = 3.14159265358979323846;
    int i, seam_zero = 0, seam_one = 0, north = 0, south = 0;
    assert(begins == 1 && ends == 1);
    assert(vertex_count == 64 * 2 * (64 - 1) * 3);
    assert(normal_count == (smooth ? vertex_count : vertex_count / 3));
    assert(texture_count == (textured ? vertex_count : 0));
    for (i = 0; i < vertex_count; ++i) {
        const RecordedVertex *v = &vertices[i];
        assert(near(length(v->x, v->y, v->z), radius));
        assert(near(length(v->nx, v->ny, v->nz), 1));
        assert(v->x*v->nx + v->y*v->ny + v->z*v->nz > 0);
        if (smooth) {
            assert(near(v->nx, v->x/radius));
            assert(near(v->ny, v->y/radius));
            assert(near(v->nz, v->z/radius));
        }
        if (textured) {
            assert(v->s >= 0 && v->s <= 1 && v->t >= 0 && v->t <= 1);
            assert(near(v->x, radius*sin(2*pi*v->s)*sin(pi*(1-v->t))));
            assert(near(v->y, radius*cos(2*pi*v->s)*sin(pi*(1-v->t))));
            assert(near(v->z, radius*cos(pi*(1-v->t))));
            if (v->s == 0 && v->t == 0.5f) {
                assert(v->x == 0 && near(v->y, radius)); ++seam_zero;
            }
            if (v->s == 1 && v->t == 0.5f) {
                assert(v->x == 0 && near(v->y, radius)); ++seam_one;
            }
            if (v->t == 0) { assert(v->x == 0 && v->y == 0); ++south; }
            if (v->t == 1) { assert(v->x == 0 && v->y == 0); ++north; }
        }
    }
    if (textured) assert(seam_zero && seam_one && north && south);
    for (i = 0; i < vertex_count; i += 3) {
        const RecordedVertex *a=&vertices[i], *b=&vertices[i+1], *c=&vertices[i+2];
        double ux=b->x-a->x, uy=b->y-a->y, uz=b->z-a->z;
        double vx=c->x-a->x, vy=c->y-a->y, vz=c->z-a->z;
        double cx=uy*vz-uz*vy, cy=uz*vx-ux*vz, cz=ux*vy-uy*vx;
        assert(length(cx,cy,cz) > 0.0000001);
        assert(cx*(a->x+b->x+c->x)+cy*(a->y+b->y+c->y)+cz*(a->z+b->z+c->z) > 0);
        if (!smooth) {
            assert(a->nx == b->nx && a->nx == c->nx);
            assert(a->ny == b->ny && a->ny == c->ny);
            assert(a->nz == b->nz && a->nz == c->nz);
            assert(cx*a->nx+cy*a->ny+cz*a->nz > 0);
        }
    }
}

int main(void)
{
    GLUquadric *a=gluNewQuadric(), *b=gluNewQuadric();
    int saved_count, i;
    assert(a && b && a != b);
    reset();
    gluSphere(a, 3.25, 64, 64);
    verify_mesh(3.25, 1, 0); /* Default smooth normals, texture disabled. */
    gluQuadricTexture(a, GL_TRUE);
    reset(); gluSphere(a, 3.25, 64, 64); verify_mesh(3.25, 1, 1);
    saved_count=vertex_count; memcpy(previous,vertices,sizeof(RecordedVertex)*vertex_count);
    reset(); gluSphere(a, 3.25, 64, 64);
    assert(vertex_count == saved_count);
    assert(memcmp(previous,vertices,sizeof(RecordedVertex)*vertex_count) == 0);
    gluQuadricNormals(a, GLU_FLAT);
    reset(); gluSphere(a, 3.25, 64, 64); verify_mesh(3.25, 0, 1);
    gluQuadricNormals(a, GLU_NONE); gluQuadricTexture(a, GL_FALSE);
    reset(); gluSphere(a, 1, 8, 4);
    assert(vertex_count == 8*2*(4-1)*3 && normal_count == 0 && texture_count == 0);
    reset(); gluSphere(b, 3.25, 64, 64); verify_mesh(3.25, 1, 0);
    gluQuadricNormals(b, (GLenum)0); /* Invalid enum leaves existing state intact. */
    reset(); gluSphere(b, 3.25, 64, 64); verify_mesh(3.25, 1, 0);
    reset();
    gluSphere(a,-1,64,64); gluSphere(a,1,2,64); gluSphere(a,1,64,1);
    gluSphere(NULL,1,64,64); gluSphere(a,NAN,64,64); gluSphere(a,INFINITY,64,64);
    assert(vertex_count == 0 && normal_count == 0 && texture_count == 0 && begins == 0);
    gluQuadricNormals(a,GLU_SMOOTH);
    reset(); gluSphere(a,0,8,4);
    assert(vertex_count == 8*2*(4-1)*3);
    for (i=0;i<vertex_count;++i) {
        assert(vertices[i].x == 0 && vertices[i].y == 0 && vertices[i].z == 0);
        assert(near(length(vertices[i].nx,vertices[i].ny,vertices[i].nz),1));
    }
    gluDeleteQuadric(a); gluDeleteQuadric(b); gluDeleteQuadric(NULL);
    puts("PASS GLU sphere: 8,064 outward triangles; radius, smooth/flat/no normals, UV/seam/poles, state isolation, repeatability, input validation");
    return 0;
}
