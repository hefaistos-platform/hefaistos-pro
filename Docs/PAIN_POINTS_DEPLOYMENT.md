# Pain Points Feature - Deployment Checklist

## Pre-Deployment Tasks

### Backend Setup

- [ ] **Create `pain_points` app directory structure**
  ```bash
  mkdir -p backend/pain_points/migrations
  touch backend/pain_points/__init__.py
  ```

- [ ] **Add to Django INSTALLED_APPS** in `backend/core/settings.py`
  ```python
  INSTALLED_APPS = [
      # ... existing apps
      'pain_points',  # Add this line
  ]
  ```

- [ ] **Update core GraphQL schema** in `backend/core/schema.py`
  ```python
  from pain_points.schema import Query as PainPointQuery
  from pain_points.schema import Mutation as PainPointMutation
  
  class Query(
      # ... existing queries
      PainPointQuery,
      graphene.ObjectType
  ):
      pass
  
  class Mutation(
      # ... existing mutations
      PainPointMutation,
      graphene.ObjectType
  ):
      pass
  ```

- [ ] **Run migrations**
  ```bash
  cd backend
  python manage.py migrate pain_points
  ```

- [ ] **Register models in Django admin** (verify `admin.py` is configured)
  - Check that `PainPoint` and `PainPointComment` appear in Django admin

- [ ] **Test GraphQL queries and mutations**
  ```bash
  python manage.py runserver
  # Visit http://localhost:8000/graphql
  # Test: allPainPoints, createPainPoint, resolvePainPoint
  ```

### Frontend Setup

- [ ] **Add route to React Router** in main app file (e.g., `App.tsx` or `routes.tsx`)
  ```tsx
  import PainPointsPage from './pages/PainPointsPage';
  
  <Route path="/pain-points" element={<PainPointsPage />} />
  ```

- [ ] **Add navigation link** in header/sidebar
  ```tsx
  <Link to="/pain-points">
    <span>📋 Pain Points</span>
  </Link>
  ```

- [ ] **Copy all component files**
  - [x] `src/pages/PainPointsPage.tsx`
  - [x] `src/components/NewPainPointModal.tsx`
  - [x] `src/components/PainPointCard.tsx`
  - [x] `src/components/PainArchiveModal.tsx`

- [ ] **Copy all style files**
  - [x] `src/styles/PainPointsPage.css`
  - [x] `src/styles/PainPointCard.css`

- [ ] **Verify Ant Design dependencies**
  ```bash
  npm list antd
  # Should show antd is installed
  ```

- [ ] **Test frontend in development**
  ```bash
  npm start
  # Navigate to /pain-points
  # Verify layout loads correctly
  ```

### Testing Checklist

#### Basic Functionality
- [ ] **User can create a pain point**
  - Login as regular user
  - Click "NEW PAIN" button
  - Fill out form with valid data
  - Click Submit
  - Verify success message
  - Pain point appears on board

- [ ] **Form validation works**
  - Try submitting empty subject
  - Try submitting subject > 80 chars (should truncate)
  - Try submitting empty description
  - Verify error messages appear

- [ ] **Character counter displays correctly**
  - Type in subject field
  - Counter shows current/max count
  - Max length enforced

- [ ] **Filtering works**
  - Filter by status (Open, In Progress, Solved, Closed)
  - Filter by priority (Low, Medium, High)
  - Filter combinations work together
  - Clear filters button works

- [ ] **Pain point details view**
  - Click on pain card
  - Modal opens with full details
  - All information displays correctly
  - Comments section visible

#### Admin Features
- [ ] **Admin can resolve pain point**
  - Login as admin user
  - Open pain point details
  - Enter resolution notes
  - Click "Mark as Solved"
  - Status changes to "Solved"
  - Resolved by and timestamp recorded

- [ ] **Admin can close pain point**
  - Follow same steps but click "Mark as Closed"
  - Status shows "Closed"

- [ ] **Archive functionality**
  - Resolve a pain point
  - Click "Archive This Pain" button
  - Pain moves to archive
  - No longer appears on main board

#### Archive View
- [ ] **Archive modal displays**
  - Click "Show Archive" button
  - Modal opens
  - Lists all archived pain points
  - Collapsible items show full details
  - Resolution notes visible

#### Data Integrity
- [ ] **User isolation**
  - Create pain point as User A in Org A
  - Login as User B in Org B
  - User B should NOT see User A's pain point
  - Create pain point as User B
  - Pain point appears only in User B's board

- [ ] **Organization isolation**
  - Verify pain_points are filtered by user.organization
  - Multi-org deployment test

#### UI/UX
- [ ] **Responsive design**
  - Test on mobile (320px width)
  - Test on tablet (768px width)
  - Test on desktop (1920px width)
  - Grid layout adjusts properly
  - Modal is readable on mobile

- [ ] **Color scheme displays correctly**
  - High priority cards show red
  - Medium priority cards show orange
  - Low priority cards show green
  - Status icons display correctly

- [ ] **Hover effects work**
  - Cards elevate on hover
  - Buttons show hover state
  - Links underline on hover

- [ ] **Tooltips display**
  - Hover over help icon in header
  - Tooltip appears with PAIN explanation

#### Performance
- [ ] **Load performance**
  - Page loads in < 3 seconds with 50 pain points
  - Infinite scroll/pagination works
  - No memory leaks

- [ ] **GraphQL queries are efficient**
  - Check GraphQL network tab
  - Verify no N+1 query issues
  - Response times < 500ms

### Deployment Steps

#### Staging Environment
1. [ ] Deploy backend code to staging
2. [ ] Run migrations: `python manage.py migrate pain_points`
3. [ ] Deploy frontend code to staging
4. [ ] Test all features in staging
5. [ ] Gather beta tester feedback

#### Production Environment
1. [ ] Create database backup before migration
2. [ ] Deploy backend code
3. [ ] Run migrations: `python manage.py migrate pain_points`
4. [ ] Verify migration completed successfully
5. [ ] Deploy frontend code
6. [ ] Clear browser cache and CDN cache
7. [ ] Test feature in production
8. [ ] Monitor error logs for 1 hour
9. [ ] Announce feature to beta users

### Post-Deployment

- [ ] **Set up monitoring**
  - Monitor error rates in Sentry
  - Track GraphQL errors
  - Monitor database query performance

- [ ] **Create admin guide**
  - Document how to resolve pain points
  - Explain resolution notes best practices
  - Show how to view analytics

- [ ] **Create user guide**
  - How to submit pain point
  - Best practices for feedback
  - What happens after submission

- [ ] **Announce feature**
  - Email announcement to beta testers
  - Add to in-app news/announcements
  - Include link to documentation
  - Explain PAIN acronym and how to use

- [ ] **Monitor initial usage**
  - Track number of pain points created
  - Measure user engagement
  - Note any technical issues
  - Collect feedback for improvements

### Next Phase Planning

- [ ] Prioritize enhancement features from [PAIN_POINTS_ENHANCEMENTS.md](PAIN_POINTS_ENHANCEMENTS.md)
- [ ] Plan voting feature implementation (if popular)
- [ ] Plan category implementation
- [ ] Plan notification system
- [ ] Schedule feature review meeting with stakeholders

---

## Troubleshooting

### Common Issues

**Problem: Pain point not appearing on board**
- Check that user is authenticated
- Verify organization is set on user model
- Check GraphQL query in Apollo DevTools
- Check console for errors

**Problem: Admin can't resolve pain points**
- Verify user has is_staff or is_superuser set
- Check that mutation is receiving admin user
- Check error message in response
- Verify permission logic in schema.py

**Problem: Styles not loading correctly**
- Verify CSS files are in correct path
- Clear browser cache (Ctrl+Shift+Delete)
- Check import statements in component files
- Verify Ant Design CSS is loaded

**Problem: Filtering not working**
- Check GraphQL variables in Apollo DevTools
- Verify filter values are correct enums
- Clear Apollo cache
- Check useQuery hook has correct variables

**Problem: Modal not opening**
- Check state variable (visible/open)
- Verify onClick handler triggers state change
- Check for JavaScript errors in console
- Verify Modal component is imported from Ant Design

### Debug Commands

```bash
# Check if migrations ran
python manage.py showmigrations pain_points

# Test GraphQL query
curl -X POST http://localhost:8000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ allPainPoints { id subject } }"}'

# Check database tables
psql your_db_name -c "\dt pain_points*"

# View app logs
docker-compose logs backend | grep pain_points
```

---

## Support & Resources

- **Documentation**: See [PAIN_POINTS_FEATURE.md](PAIN_POINTS_FEATURE.md)
- **Enhancement Ideas**: See [PAIN_POINTS_ENHANCEMENTS.md](PAIN_POINTS_ENHANCEMENTS.md)
- **GraphQL Schema**: Review `backend/pain_points/schema.py`
- **Database Models**: Review `backend/pain_points/models.py`
- **React Components**: Check `frontend/src/components/` and `frontend/src/pages/`

---

**Feature Status**: ✅ Ready for Beta Testing
**Last Updated**: January 23, 2026
**Version**: 1.0.0
